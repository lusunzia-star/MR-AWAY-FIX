import { supabase } from './supabaseClient.js';


// ======================================================
// MR AWAY FIX — MAIN ELEMENTS
// ======================================================

const services = document.getElementById("services");
const provider = document.getElementById("provider");
const providerJobs = document.getElementById("providerJobs");
const requestBox = document.getElementById("requestBox");

const customerBtn = document.getElementById("customerBtn");
const providerBtn = document.getElementById("providerBtn");


// ======================================================
// JOB HISTORY
// ======================================================

const jobHistory = document.getElementById("jobHistory");
const historyList = document.getElementById("historyList");


// ======================================================
// PROVIDER PROFILES
// ======================================================

const providerProfiles =
  document.getElementById("providerProfiles");

const providerProfilesList =
  document.getElementById("providerProfilesList");


// ======================================================
// NOTIFICATIONS
// ======================================================

const notifications =
  document.getElementById("notifications");

const notificationsList =
  document.getElementById("notificationsList");


// ======================================================
// AUTH
// ======================================================

const loginBtn = document.getElementById("loginBtn");
const authBox = document.getElementById("authBox");
const authTitle = document.getElementById("authTitle");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authSubmit = document.getElementById("authSubmit");
const switchAuth = document.getElementById("switchAuth");
const closeAuth = document.getElementById("closeAuth");
const authStatus = document.getElementById("authStatus");


// ======================================================
// CUSTOMER REQUEST
// ======================================================

const submitRequest =
  document.getElementById("submitRequest");


// ======================================================
// PROVIDER REGISTRATION
// ======================================================

const providerName =
  document.getElementById("providerName");

const providerService =
  document.getElementById("providerService");

const providerArea =
  document.getElementById("providerArea");

const saveProvider =
  document.getElementById("saveProvider");

const providerStatus =
  document.getElementById("providerStatus");


// ======================================================
// GLOBAL STATE
// ======================================================

let selectedService = "";
let authMode = "signin";

let localProvidersLoading = false;

let providerSearchText = "";
let providerServiceFilter = "";
let providerAreaFilter = "";


// ======================================================
// CUSTOMER REQUEST LOCAL STORAGE
// ======================================================

const CUSTOMER_REQUEST_KEY =
  "mrAwayFixCustomerRequests";


function getSavedCustomerRequests() {

  try {

    return JSON.parse(
      localStorage.getItem(
        CUSTOMER_REQUEST_KEY
      ) || "[]"
    );

  } catch {

    return [];

  }
}


function saveCustomerRequestId(id) {

  if (!id) return;

  const ids =
    getSavedCustomerRequests();

  if (!ids.includes(id)) {
    ids.push(id);
  }

  localStorage.setItem(
    CUSTOMER_REQUEST_KEY,
    JSON.stringify(ids)
  );
}


function removeCustomerRequestId(id) {

  if (!id) return;

  const ids =
    getSavedCustomerRequests()
      .filter(item => item !== id);

  localStorage.setItem(
    CUSTOMER_REQUEST_KEY,
    JSON.stringify(ids)
  );
}


// ======================================================
// HELPERS
// ======================================================

function escapeHtml(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function formatDate(value) {

  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}


function stars(rating) {

  const number =
    Math.max(
      0,
      Math.min(
        5,
        Math.round(Number(rating) || 0)
      )
    );

  return (
    "★".repeat(number) +
    "☆".repeat(5 - number)
  );
}


function showElement(element) {

  if (element) {
    element.classList.remove("hidden");
  }
}


function hideElement(element) {

  if (element) {
    element.classList.add("hidden");
  }
}


// ======================================================
// PROVIDER PHONE INPUT
//
// The HTML does not need to be changed.
// This creates the phone field automatically.
// ======================================================

function ensureProviderPhoneInput() {

  let phoneInput =
    document.getElementById("providerPhone");

  if (phoneInput) {
    return phoneInput;
  }

  if (!providerArea) {
    return null;
  }

  phoneInput =
    document.createElement("input");

  phoneInput.id = "providerPhone";
  phoneInput.type = "tel";
  phoneInput.placeholder = "Phone number";
  phoneInput.autocomplete = "tel";

  providerArea.insertAdjacentElement(
    "afterend",
    phoneInput
  );

  return phoneInput;
}


// ======================================================
// PHONE HELPERS
// ======================================================

function cleanPhone(phone) {

  return String(phone || "")
    .trim()
    .replace(/[^\d+]/g, "");
}


function whatsappNumber(phone) {

  let number =
    cleanPhone(phone)
      .replace(/\+/g, "");

  // South African local number:
  // 0821234567 -> 27821234567

  if (
    number.startsWith("0")
  ) {

    number =
      "27" +
      number.substring(1);
  }

  return number;
}


function phoneButtons(phone) {

  if (!phone) {
    return `
      <p>
        <strong>Phone:</strong>
        Not provided
      </p>
    `;
  }

  const clean =
    cleanPhone(phone);

  const wa =
    whatsappNumber(phone);

  return `
    <p>
      <strong>Phone:</strong>
      ${escapeHtml(phone)}
    </p>

    <div class="provider-contact-actions">

      <a
        href="tel:${escapeHtml(clean)}"
        class="primary"
        style="
          display:inline-block;
          text-decoration:none;
          border-radius:12px;
          padding:13px 18px;
          margin:5px;
          font-weight:700;
        "
      >
        📞 Call Provider
      </a>

      <a
        href="https://wa.me/${escapeHtml(wa)}"
        target="_blank"
        rel="noopener noreferrer"
        class="outline"
        style="
          display:inline-block;
          text-decoration:none;
          border-radius:12px;
          padding:13px 18px;
          margin:5px;
          font-weight:700;
        "
      >
        💬 WhatsApp
      </a>

    </div>
  `;
}


// ======================================================
// ENSURE CUSTOMER PROFILE
// ======================================================

async function ensureCustomerProfile(user) {

  if (!user) return null;

  const {
    data: existing,
    error: selectError
  } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) {

    console.error(
      "Profile check error:",
      selectError
    );

    return null;
  }

  if (existing) {
    return existing;
  }

  const {
    data: created,
    error: insertError
  } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      role: "customer"
    })
    .select("id, role")
    .single();

  if (insertError) {

    console.error(
      "Profile creation error:",
      insertError
    );

    return null;
  }

  return created;
}


// ======================================================
// GET PROVIDER NAME FOR A JOB
// ======================================================

async function getProviderForJob(requestId) {

  if (!requestId) {
    return "Provider";
  }

  const {
    data: responses,
    error
  } = await supabase
    .from("service_responses")
    .select(
      "id, provider_name, provider_service, provider_location, status"
    )
    .eq(
      "request_id",
      requestId
    )
    .order("id", {
      ascending: false
    });

  if (error) {

    console.error(
      "Provider lookup error:",
      error
    );

    return "Provider";
  }

  if (!responses || !responses.length) {
    return "Provider";
  }

  const selected =
    responses.find(
      item =>
        item.status === "completed" ||
        item.status === "in_progress" ||
        item.status === "accepted"
    ) || responses[0];

  return (
    selected.provider_name ||
    "Provider"
  );
}


// ======================================================
// NOTIFICATIONS
// ======================================================

async function loadNotifications() {

  if (
    !notifications ||
    !notificationsList
  ) {
    return;
  }

  const {
    data: {
      user
    }
  } = await supabase.auth.getUser();

  if (!user) {

    hideElement(notifications);

    notificationsList.innerHTML = "";

    return;
  }

  showElement(notifications);

  const items = [];


  // CUSTOMER NOTIFICATIONS
  const {
    data: customerJobs,
    error: customerJobsError
  } = await supabase
    .from("service_requests")
    .select("*")
    .eq(
      "customer_id",
      user.id
    )
    .order("id", {
      ascending: false
    });

  if (
    !customerJobsError &&
    customerJobs
  ) {

    for (const job of customerJobs) {

      const {
        data: responses
      } = await supabase
        .from("service_responses")
        .select("*")
        .eq(
          "request_id",
          job.id
        )
        .order("id", {
          ascending: false
        });

      if (
        job.status === "posted" &&
        job.is_active !== false
      ) {

        items.push(
          `Your ${job.service_type} request is waiting for a provider.`
        );
      }

      if (responses) {

        for (const response of responses) {

          const providerNameText =
            response.provider_name ||
            "A provider";

          if (
            response.status === "pending"
          ) {

            items.push(
              `${providerNameText} has responded to your ${job.service_type} request.`
            );
          }

          if (
            response.status === "accepted"
          ) {

            items.push(
              `${providerNameText} was accepted for your ${job.service_type} job.`
            );
          }

          if (
            response.status === "rejected"
          ) {

            items.push(
              `${providerNameText}'s response to your ${job.service_type} request was rejected.`
            );
          }

          if (
            response.status === "in_progress" ||
            job.status === "in_progress"
          ) {

            items.push(
              `Your ${job.service_type} job is in progress with ${providerNameText}.`
            );
          }

          if (
            response.status === "completed"
          ) {

            items.push(
              `Your ${job.service_type} job with ${providerNameText} has been completed.`
            );
          }
        }
      }

      if (
        job.status === "completed"
      ) {

        items.push(
          `Your ${job.service_type} job has been completed.`
        );
      }
    }
  }


  // PROVIDER NOTIFICATIONS
  const currentProviderName =
    providerName?.value?.trim();

  if (currentProviderName) {

    const {
      data: providerResponses
    } = await supabase
      .from("service_responses")
      .select("*")
      .eq(
        "provider_name",
        currentProviderName
      )
      .order("id", {
        ascending: false
      });

    if (providerResponses) {

      for (
        const response of providerResponses
      ) {

        const {
          data: job
        } = await supabase
          .from("service_requests")
          .select("*")
          .eq(
            "id",
            response.request_id
          )
          .maybeSingle();

        if (!job) continue;

        if (
          response.status === "pending"
        ) {

          items.push(
            `Your response was sent for the ${job.service_type} job.`
          );
        }

        if (
          response.status === "accepted"
        ) {

          items.push(
            `You were accepted for the ${job.service_type} job.`
          );
        }

        if (
          response.status === "rejected"
        ) {

          items.push(
            `Your response for the ${job.service_type} job was rejected.`
          );
        }

        if (
          response.status === "in_progress" ||
          job.status === "in_progress"
        ) {

          items.push(
            `Your ${job.service_type} job is currently in progress.`
          );
        }

        if (
          response.status === "completed" ||
          job.status === "completed"
        ) {

          items.push(
            `Your ${job.service_type} job has been completed.`
          );
        }
      }
    }
  }


  const uniqueItems =
    [...new Set(items)].slice(0, 20);

  if (!uniqueItems.length) {

    notificationsList.innerHTML = `
      <div class="card">
        <p>No new notifications.</p>
      </div>
    `;

    return;
  }

  notificationsList.innerHTML =
    uniqueItems.map(item => `
      <div class="card">
        <p>
          🔔 ${escapeHtml(item)}
        </p>
      </div>
    `).join("");
}


// ======================================================
// PROVIDER SEARCH & FILTER
// ======================================================

async function loadLocalServiceProviders() {

  if (
    !providerProfiles ||
    !providerProfilesList
  ) {
    return;
  }

  if (localProvidersLoading) {
    return;
  }

  localProvidersLoading = true;

  try {

    const {
      data: providers,
      error
    } = await supabase
      .from("service_providers")
      .select(
        "id, business_name, service_type, location, phone"
      )
      .order("id", {
        ascending: false
      });

    if (error) {

      console.error(
        "Provider loading error:",
        error
      );

      providerProfilesList.innerHTML = `
        <div class="card">
          <p>Unable to load providers.</p>
        </div>
      `;

      return;
    }


    let controls =
      document.getElementById(
        "providerSearchControls"
      );


    if (!controls) {

      controls =
        document.createElement("div");

      controls.id =
        "providerSearchControls";

      controls.className =
        "card";

      controls.innerHTML = `
        <input
          id="providerSearchInput"
          type="text"
          placeholder="Search provider..."
        >

        <select
          id="providerServiceFilter"
        >
          <option value="">
            All services
          </option>
        </select>

        <input
          id="providerAreaFilter"
          type="text"
          placeholder="Search area..."
        >

        <button
          id="clearProviderFilters"
          type="button"
          class="outline"
        >
          Clear
        </button>

        <p id="providerResultsCount"></p>
      `;


      providerProfiles.insertBefore(
        controls,
        providerProfilesList
      );


      const searchInput =
        document.getElementById(
          "providerSearchInput"
        );

      const serviceFilter =
        document.getElementById(
          "providerServiceFilter"
        );

      const areaFilter =
        document.getElementById(
          "providerAreaFilter"
        );

      const clearButton =
        document.getElementById(
          "clearProviderFilters"
        );


      searchInput?.addEventListener(
        "input",
        () => {

          providerSearchText =
            searchInput.value
              .trim()
              .toLowerCase();

          renderProviderResults(
            providers || []
          );
        }
      );


      serviceFilter?.addEventListener(
        "change",
        () => {

          providerServiceFilter =
            serviceFilter.value
              .trim()
              .toLowerCase();

          renderProviderResults(
            providers || []
          );
        }
      );


      areaFilter?.addEventListener(
        "input",
        () => {

          providerAreaFilter =
            areaFilter.value
              .trim()
              .toLowerCase();

          renderProviderResults(
            providers || []
          );
        }
      );


      clearButton?.addEventListener(
        "click",
        () => {

          searchInput.value = "";
          serviceFilter.value = "";
          areaFilter.value = "";

          providerSearchText = "";
          providerServiceFilter = "";
          providerAreaFilter = "";

          renderProviderResults(
            providers || []
          );
        }
      );
    }


    const serviceFilter =
      document.getElementById(
        "providerServiceFilter"
      );


    const servicesFound = [
      ...new Set(
        (providers || [])
          .map(item =>
            item.service_type
          )
          .filter(Boolean)
      )
    ].sort();


    if (serviceFilter) {

      serviceFilter.innerHTML =
        `<option value="">All services</option>` +
        servicesFound.map(service => `
          <option
            value="${escapeHtml(service)}"
          >
            ${escapeHtml(service)}
          </option>
        `).join("");

      serviceFilter.value =
        providerServiceFilter;
    }


    renderProviderResults(
      providers || []
    );

  } finally {

    localProvidersLoading = false;
  }
}


// ======================================================
// RENDER PROVIDER RESULTS
// ======================================================

async function renderProviderResults(
  providers
) {

  if (!providerProfilesList) {
    return;
  }


  const filtered =
    providers.filter(item => {

      const name =
        String(
          item.business_name || ""
        ).toLowerCase();

      const service =
        String(
          item.service_type || ""
        ).toLowerCase();

      const area =
        String(
          item.location || ""
        ).toLowerCase();


      const matchesSearch =
        !providerSearchText ||
        name.includes(providerSearchText) ||
        service.includes(providerSearchText) ||
        area.includes(providerSearchText);


      const matchesService =
        !providerServiceFilter ||
        service === providerServiceFilter;


      const matchesArea =
        !providerAreaFilter ||
        area.includes(providerAreaFilter);


      return (
        matchesSearch &&
        matchesService &&
        matchesArea
      );
    });


  const count =
    document.getElementById(
      "providerResultsCount"
    );


  if (count) {

    count.textContent =
      `${filtered.length} provider(s) found`;
  }


  if (!filtered.length) {

    providerProfilesList.innerHTML = `
      <div class="card">
        <p>No providers found.</p>
      </div>
    `;

    return;
  }


  providerProfilesList.innerHTML =
    filtered.map(item => `
      <div
        class="card provider-card"
        data-provider-id="${escapeHtml(item.id)}"
      >

        <h3>
          ${escapeHtml(
            item.business_name
          )}
        </h3>

        <p>
          <strong>Service:</strong>
          ${escapeHtml(
            item.service_type
          )}
        </p>

        <p>
          <strong>Area:</strong>
          ${escapeHtml(
            item.location
          )}
        </p>

        ${phoneButtons(item.phone)}

        <div
          class="provider-rating"
          data-rating-provider="${escapeHtml(
            item.business_name
          )}"
        >
          Loading rating...
        </div>

        <button
          type="button"
          class="outline view-provider-btn"
          data-provider-name="${escapeHtml(
            item.business_name
          )}"
        >
          View Provider
        </button>

        <div
          class="provider-details hidden"
          data-provider-details="${escapeHtml(
            item.business_name
          )}"
        ></div>

      </div>
    `).join("");


  // ====================================================
  // RATINGS
  // ====================================================

  for (const item of filtered) {

    const {
      data: reviews
    } = await supabase
      .from("service_reviews")
      .select(
        "rating, review"
      )
      .eq(
        "provider_name",
        item.business_name
      );


    const ratingBox =
      document.querySelector(
        `[data-rating-provider="${CSS.escape(
          item.business_name
        )}"]`
      );


    if (!ratingBox) continue;


    if (
      !reviews ||
      !reviews.length
    ) {

      ratingBox.innerHTML =
        `⭐ No reviews yet`;

      continue;
    }


    const average =
      reviews.reduce(
        (sum, review) =>
          sum +
          Number(
            review.rating || 0
          ),
        0
      ) / reviews.length;


    ratingBox.innerHTML = `
      <strong>
        ${stars(average)}
      </strong>
      ${average.toFixed(1)}/5
      (${reviews.length}
      review${reviews.length === 1 ? "" : "s"})
    `;
  }


  // ====================================================
  // VIEW PROVIDER
  // ====================================================

  document
    .querySelectorAll(
      ".view-provider-btn"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        async () => {

          const name =
            button.dataset.providerName;


          const details =
            document.querySelector(
              `[data-provider-details="${CSS.escape(
                name
              )}"]`
            );


          if (!details) return;


          if (
            !details.classList.contains(
              "hidden"
            )
          ) {

            details.classList.add(
              "hidden"
            );

            button.textContent =
              "View Provider";

            return;
          }


          details.classList.remove(
            "hidden"
          );

          button.textContent =
            "Hide Provider";


          const providerRecord =
            providers.find(
              item =>
                String(item.business_name) ===
                String(name)
            );


          const {
            data: reviews
          } = await supabase
            .from("service_reviews")
            .select(
              "rating, review"
            )
            .eq(
              "provider_name",
              name
            )
            .order("id", {
              ascending: false
            })
            .limit(5);


          details.innerHTML = `
            <hr>

            <h4>
              Provider Details
            </h4>

            ${phoneButtons(
              providerRecord?.phone
            )}

            <h4>
              Customer Reviews
            </h4>

            ${
              !reviews ||
              !reviews.length
                ? `
                  <p>
                    No customer reviews yet.
                  </p>
                `
                : reviews.map(review => `
                  <div class="card">

                    <p>
                      <strong>
                        ${stars(
                          review.rating
                        )}
                      </strong>
                    </p>

                    <p>
                      ${escapeHtml(
                        review.review ||
                        "No written review."
                      )}
                    </p>

                  </div>
                `).join("")
            }
          `;
        }
      );
    });
}


// ======================================================
// CUSTOMER MODE
// ======================================================

customerBtn?.addEventListener(
  "click",
  async () => {

    showElement(services);
    showElement(providerProfiles);
    showElement(jobHistory);

    hideElement(provider);
    hideElement(providerJobs);

    await loadCustomerResponses();
    await loadCustomerHistory();
    await loadLocalServiceProviders();
    await loadNotifications();

    services?.scrollIntoView({
      behavior: "smooth"
    });
  }
);


// ======================================================
// PROVIDER MODE
// ======================================================

providerBtn?.addEventListener(
  "click",
  async () => {

    hideElement(services);
    hideElement(providerProfiles);
    hideElement(jobHistory);

    showElement(provider);
    showElement(providerJobs);

    ensureProviderPhoneInput();

    await loadJobs();
    await loadProviderReviews();
    await loadNotifications();

    provider?.scrollIntoView({
      behavior: "smooth"
    });
  }
);


// ======================================================
// SERVICE BUTTONS
// ======================================================

document
  .querySelectorAll(
    "[data-service]"
  )
  .forEach(button => {

    button.addEventListener(
      "click",
      async () => {

        selectedService =
          button.dataset.service;


        if (requestBox) {

          requestBox.dataset.service =
            selectedService;

          delete requestBox.dataset.requestId;

          showElement(requestBox);

          requestBox.scrollIntoView({
            behavior: "smooth"
          });
        }


        await loadCustomerResponses();
        await loadCustomerHistory();
        await loadLocalServiceProviders();
        await loadNotifications();
      }
    );
  });


// ======================================================
// CUSTOMER RESPONSES
// ======================================================

async function loadCustomerResponses() {

  const responsesBox =
    document.getElementById(
      "customerResponses"
    );


  if (!responsesBox) {
    return;
  }


  const {
    data: {
      user
    }
  } = await supabase.auth.getUser();


  if (!user) {

    responsesBox.innerHTML = `
      <p>
        Please sign in to see your service responses.
      </p>
    `;

    return;
  }


  let requestId =
    requestBox?.dataset.requestId;

  let request = null;


  if (requestId) {

    const {
      data
    } = await supabase
      .from("service_requests")
      .select("*")
      .eq(
        "id",
        requestId
      )
      .eq(
        "customer_id",
        user.id
      )
      .maybeSingle();

    request = data;
  }


  if (
    !request &&
    requestBox?.dataset.service
  ) {

    const {
      data
    } = await supabase
      .from("service_requests")
      .select("*")
      .eq(
        "customer_id",
        user.id
      )
      .eq(
        "service_type",
        requestBox.dataset.service
      )
      .order("id", {
        ascending: false
      })
      .limit(1)
      .maybeSingle();

    request = data;


    if (
      request &&
      requestBox
    ) {

      requestBox.dataset.requestId =
        request.id;
    }
  }


  if (!request) {

    responsesBox.innerHTML = `
      <p>
        No service request found yet.
      </p>
    `;

    return;
  }


  const statusText =
    request.status ||
    "posted";


  const {
    data: responses,
    error
  } = await supabase
    .from("service_responses")
    .select("*")
    .eq(
      "request_id",
      request.id
    )
    .order("id", {
      ascending: false
    });


  if (error) {

    responsesBox.innerHTML = `
      <p>
        Unable to load provider responses.
      </p>
    `;

    console.error(error);

    return;
  }


  let html = `
    <div class="card">

      <p>
        <strong>
          Job status:
        </strong>

        ${escapeHtml(statusText)}
      </p>

    </div>
  `;


  if (
    !responses ||
    !responses.length
  ) {

    html += `
      <div class="card">

        <p>
          Waiting for providers to respond.
        </p>

      </div>
    `;

    responsesBox.innerHTML =
      html;

    return;
  }


  for (
    const response of responses
  ) {

    const providerText =
      response.provider_name ||
      "Provider";


    let actionHtml = "";


    if (
      response.status === "pending" &&
      request.status === "posted"
    ) {

      actionHtml = `
        <button
          type="button"
          class="accept-provider-btn"
          data-response-id="${escapeHtml(
            response.id
          )}"
          data-request-id="${escapeHtml(
            request.id
          )}"
        >
          Accept Provider
        </button>

        <button
          type="button"
          class="reject-provider-btn outline"
          data-response-id="${escapeHtml(
            response.id
          )}"
          data-request-id="${escapeHtml(
            request.id
          )}"
        >
          Reject
        </button>
      `;
    }


    html += `
      <div class="card">

        <h4>
          ${escapeHtml(providerText)}
        </h4>

        <p>
          Service:
          ${escapeHtml(
            response.provider_service ||
            request.service_type ||
            ""
          )}
        </p>

        <p>
          Provider area:
          ${escapeHtml(
            response.provider_location ||
            ""
          )}
        </p>

        <p>
          Status:
          <strong>
            ${escapeHtml(
              response.status ||
              "pending"
            )}
          </strong>
        </p>

        ${actionHtml}

      </div>
    `;
  }


  responsesBox.innerHTML =
    html;


  // ACCEPT
  document
    .querySelectorAll(
      ".accept-provider-btn"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        async () => {

          const responseId =
            button.dataset.responseId;

          const requestId =
            button.dataset.requestId;

          button.disabled = true;


          const {
            data: selectedResponse,
            error: responseError
          } = await supabase
            .from("service_responses")
            .select("*")
            .eq(
              "id",
              responseId
            )
            .maybeSingle();


          if (
            responseError ||
            !selectedResponse
          ) {

            alert(
              "Unable to find this provider response."
            );

            button.disabled = false;

            return;
          }


          const {
            error: acceptError
          } = await supabase
            .from("service_responses")
            .update({
              status: "accepted"
            })
            .eq(
              "id",
              responseId
            );


          if (acceptError) {

            console.error(
              acceptError
            );

            alert(
              "Unable to accept provider."
            );

            button.disabled = false;

            return;
          }


          await supabase
            .from("service_responses")
            .update({
              status: "rejected"
            })
            .eq(
              "request_id",
              requestId
            )
            .eq(
              "status",
              "pending"
            )
            .neq(
              "id",
              responseId
            );


          const {
            error: jobAcceptError
          } = await supabase
            .from("service_requests")
            .update({
              status: "accepted",
              is_active: false
            })
            .eq(
              "id",
              requestId
            );


          if (jobAcceptError) {

            console.error(
              jobAcceptError
            );

            alert(
              "Provider accepted, but the job status could not be updated."
            );

            button.disabled = false;

            return;
          }


          await loadCustomerResponses();
          await loadCustomerHistory();
          await loadNotifications();
        }
      );
    });


  // REJECT
  document
    .querySelectorAll(
      ".reject-provider-btn"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        async () => {

          const responseId =
            button.dataset.responseId;

          button.disabled = true;


          const {
            error
          } = await supabase
            .from("service_responses")
            .update({
              status: "rejected"
            })
            .eq(
              "id",
              responseId
            );


          if (error) {

            console.error(error);

            alert(
              "Unable to reject provider."
            );

            button.disabled = false;

            return;
          }


          await loadCustomerResponses();
          await loadCustomerHistory();
          await loadNotifications();
        }
      );
    });
}


// ======================================================
// CUSTOMER SUBMIT REQUEST
// ======================================================

submitRequest?.addEventListener(
  "click",
  async () => {

    const description =
      document.getElementById(
        "description"
      )?.value.trim();

    const location =
      document.getElementById(
        "location"
      )?.value.trim();

    const service =
      selectedService ||
      requestBox?.dataset.service;


    if (!service) {

      alert(
        "Please select a service first."
      );

      return;
    }


    if (
      !description ||
      !location
    ) {

      alert(
        "Please enter the job description and location."
      );

      return;
    }


    const {
      data: {
        user
      }
    } = await supabase.auth.getUser();


    if (!user) {

      alert(
        "Please sign in before posting a service request."
      );

      showAuthBox();

      return;
    }


    const profile =
      await ensureCustomerProfile(
        user
      );


    if (!profile) {

      alert(
        "Your account profile could not be verified. Please sign in again."
      );

      return;
    }


    const {
      data: request,
      error
    } = await supabase
      .from("service_requests")
      .insert({
        customer_id: user.id,
        service_type: service,
        description,
        location,
        status: "posted",
        is_active: true
      })
      .select()
      .single();


    if (error) {

      console.error(
        "Request insert error:",
        error
      );

      alert(
        "Unable to post your service request."
      );

      return;
    }


    if (requestBox) {

      requestBox.dataset.requestId =
        request.id;
    }


    saveCustomerRequestId(
      request.id
    );


    const requestStatus =
      document.getElementById(
        "requestStatus"
      );


    if (requestStatus) {

      requestStatus.textContent =
        "Your service request has been posted successfully.";
    }


    const descriptionInput =
      document.getElementById(
        "description"
      );

    const locationInput =
      document.getElementById(
        "location"
      );


    if (descriptionInput) {
      descriptionInput.value = "";
    }

    if (locationInput) {
      locationInput.value = "";
    }


    await loadCustomerResponses();
    await loadCustomerHistory();
    await loadLocalServiceProviders();
    await loadNotifications();
  }
);


// ======================================================
// CUSTOMER JOB HISTORY
// ======================================================

async function loadCustomerHistory() {

  if (!historyList) {
    return;
  }


  const {
    data: {
      user
    }
  } = await supabase.auth.getUser();


  if (!user) {

    historyList.innerHTML = `
      <p>
        Please sign in to see your job history.
      </p>
    `;

    return;
  }


  const {
    data: jobs,
    error
  } = await supabase
    .from("service_requests")
    .select("*")
    .eq(
      "customer_id",
      user.id
    )
    .eq(
      "status",
      "completed"
    )
    .order("id", {
      ascending: false
    });


  if (error) {

    console.error(
      "Customer history error:",
      error
    );

    showEmptyHistory();

    return;
  }


  if (
    !jobs ||
    !jobs.length
  ) {

    showEmptyHistory();

    return;
  }


  let html = "";


  for (
    const job of jobs
  ) {

    const providerText =
      await getProviderForJob(
        job.id
      );


    html += `
      <div class="card">

        <h3>
          ${escapeHtml(
            job.service_type
          )}
        </h3>

        <p>
          <strong>
            Provider:
          </strong>

          ${escapeHtml(
            providerText
          )}
        </p>

        <p>
          <strong>
            Location:
          </strong>

          ${escapeHtml(
            job.location
          )}
        </p>

        <p>
          <strong>
            Status:
          </strong>

          Completed
        </p>

        <p>
          <strong>
            Date:
          </strong>

          ${formatDate(
            job.created_at
          )}
        </p>

        <div
          id="rating-${escapeHtml(
            job.id
          )}"
        >
          Loading rating...
        </div>

      </div>
    `;
  }


  historyList.innerHTML =
    html;


  for (
    const job of jobs
  ) {

    const providerText =
      await getProviderForJob(
        job.id
      );

    await loadCustomerRating(
      job.id,
      providerText
    );
  }
}


// ======================================================
// EMPTY HISTORY
// ======================================================

function showEmptyHistory() {

  if (!historyList) {
    return;
  }

  historyList.innerHTML = `
    <div class="card">
      <p>
        No completed jobs yet.
      </p>
    </div>
  `;
}


// ======================================================
// CUSTOMER RATING
// ======================================================

async function loadCustomerRating(
  requestId,
  providerNameValue
) {

  const box =
    document.getElementById(
      `rating-${requestId}`
    );


  if (!box) {
    return;
  }


  const {
    data: existingReview
  } = await supabase
    .from("service_reviews")
    .select("*")
    .eq(
      "request_id",
      requestId
    )
    .maybeSingle();


  if (existingReview) {

    box.innerHTML = `
      <hr>

      <p>
        <strong>
          Your rating:
        </strong>

        ${stars(
          existingReview.rating
        )}
      </p>

      <p>
        ${escapeHtml(
          existingReview.review ||
          "No written review."
        )}
      </p>
    `;

    return;
  }


  box.innerHTML = `
    <hr>

    <p>
      <strong>
        Rate this provider
      </strong>
    </p>

    <div class="rating-buttons">

      ${[1,2,3,4,5].map(number => `
        <button
          type="button"
          class="rating-star-btn outline"
          data-rating="${number}"
        >
          ${number} ★
        </button>
      `).join("")}

    </div>

    <textarea
      class="customer-review-text"
      placeholder="Write a review (optional)"
    ></textarea>

    <button
      type="button"
      class="submit-review-btn"
    >
      Submit Review
    </button>

    <p class="review-status"></p>
  `;


  let selectedRating = 0;


  box
    .querySelectorAll(
      ".rating-star-btn"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          selectedRating =
            Number(
              button.dataset.rating
            );


          box
            .querySelectorAll(
              ".rating-star-btn"
            )
            .forEach(item => {

              item.classList.remove(
                "selected"
              );
            });


          button.classList.add(
            "selected"
          );
        }
      );
    });


  const submitReviewButton =
    box.querySelector(
      ".submit-review-btn"
    );


  submitReviewButton?.addEventListener(
    "click",
    async () => {

      const status =
        box.querySelector(
          ".review-status"
        );


      const reviewText =
        box.querySelector(
          ".customer-review-text"
        )?.value.trim();


      if (!selectedRating) {

        if (status) {

          status.textContent =
            "Please select a rating.";
        }

        return;
      }


      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();


      if (!user) {

        if (status) {

          status.textContent =
            "Please sign in again.";
        }

        return;
      }


      submitReviewButton.disabled =
        true;


      const {
        error
      } = await supabase
        .from("service_reviews")
        .insert({
          request_id:
            requestId,

          provider_name:
            providerNameValue,

          rating:
            selectedRating,

          review:
            reviewText
        });


      if (error) {

        console.error(
          "Review error:",
          error
        );

        if (status) {

          status.textContent =
            "Unable to submit review.";
        }

        submitReviewButton.disabled =
          false;

        return;
      }


      if (status) {

        status.textContent =
          "Thank you! Your review was submitted.";
      }


      await loadCustomerHistory();
      await loadLocalServiceProviders();
      await loadProviderReviews();
      await loadNotifications();
    }
  );
}


// ======================================================
// PROVIDER REGISTRATION
// ======================================================

saveProvider?.addEventListener(
  "click",
  async () => {

    const name =
      providerName?.value.trim();

    const service =
      providerService?.value.trim();

    const area =
      providerArea?.value.trim();

    const phoneInput =
      ensureProviderPhoneInput();

    const phone =
      phoneInput?.value.trim() || "";


    if (
      !name ||
      !service ||
      !area ||
      !phone
    ) {

      if (providerStatus) {

        providerStatus.textContent =
          "Please complete all provider details, including your phone number.";
      }

      return;
    }


    const {
      data: {
        user
      }
    } = await supabase.auth.getUser();


    if (!user) {

      if (providerStatus) {

        providerStatus.textContent =
          "Please sign in before registering as a provider.";
      }

      showAuthBox();

      return;
    }


    const {
      error
    } = await supabase
      .from("service_providers")
      .insert({
        business_name: name,
        service_type: service,
        location: area,
        phone: phone
      });


    if (error) {

      console.error(
        "Provider registration error:",
        error
      );

      if (providerStatus) {

        providerStatus.textContent =
          "Unable to register provider: " +
          error.message;
      }

      return;
    }


    if (providerStatus) {

      providerStatus.textContent =
        "Provider registered successfully with phone number.";
    }


    await loadLocalServiceProviders();
    await loadJobs();
    await loadProviderReviews();
    await loadNotifications();
  }
);


// ======================================================
// PROVIDER CUSTOMER REVIEW
// ======================================================

async function loadJobCustomerReview(
  requestId
) {

  const reviewBox =
    document.getElementById(
      `job-review-${requestId}`
    );


  if (!reviewBox) {
    return;
  }


  const {
    data: review
  } = await supabase
    .from("service_reviews")
    .select("*")
    .eq(
      "request_id",
      requestId
    )
    .maybeSingle();


  if (!review) {

    reviewBox.innerHTML = `
      <p>
        No customer review yet.
      </p>
    `;

    return;
  }


  reviewBox.innerHTML = `
    <div class="card">

      <p>
        <strong>
          Customer rating:
        </strong>

        ${stars(
          review.rating
        )}
      </p>

      <p>
        ${escapeHtml(
          review.review ||
          "No written review."
        )}
      </p>

    </div>
  `;
}


// ======================================================
// PROVIDER REVIEWS
// ======================================================

async function loadProviderReviews() {

  const reviewBox =
    document.getElementById(
      "providerReviews"
    );


  if (!reviewBox) {
    return;
  }


  const name =
    providerName?.value.trim();


  if (!name) {

    reviewBox.innerHTML =
      `<p>Enter your provider name to see reviews.</p>`;

    return;
  }


  const {
    data: reviews,
    error
  } = await supabase
    .from("service_reviews")
    .select(
      "rating, review"
    )
    .eq(
      "provider_name",
      name
    )
    .order("id", {
      ascending: false
    });


  if (error) {

    console.error(error);

    reviewBox.innerHTML =
      `<p>Unable to load reviews.</p>`;

    return;
  }


  if (
    !reviews ||
    !reviews.length
  ) {

    reviewBox.innerHTML = `
      <p>
        No customer reviews yet.
      </p>
    `;

    return;
  }


  const average =
    reviews.reduce(
      (sum, item) =>
        sum +
        Number(
          item.rating || 0
        ),
      0
    ) / reviews.length;


  reviewBox.innerHTML = `
    <div class="card">

      <h3>
        Your Rating
      </h3>

      <p>
        <strong>
          ${stars(average)}
        </strong>

        ${average.toFixed(1)}/5
      </p>

      <p>
        ${reviews.length}
        review${reviews.length === 1 ? "" : "s"}
      </p>

    </div>

    <h3>
      Customer Reviews
    </h3>

    ${reviews.map(review => `
      <div class="card">

        <p>
          <strong>
            ${stars(
              review.rating
            )}
          </strong>
        </p>

        <p>
          ${escapeHtml(
            review.review ||
            "No written review."
          )}
        </p>

      </div>
    `).join("")}
  `;
}


// ======================================================
// PROVIDER JOBS
// ======================================================

async function loadJobs() {

  const jobsList =
    document.getElementById(
      "jobsList"
    );


  if (!jobsList) {
    return;
  }


  const {
    data: {
      user
    }
  } = await supabase.auth.getUser();


  if (!user) {

    jobsList.innerHTML = `
      <p>
        Please sign in to see provider jobs.
      </p>
    `;

    return;
  }


  ensureProviderPhoneInput();


  const name =
    providerName?.value.trim();

  const service =
    providerService?.value.trim();

  const area =
    providerArea?.value.trim();


  if (
    !name ||
    !service ||
    !area
  ) {

    jobsList.innerHTML = `
      <div class="card">

        <p>
          Enter your provider name,
          service and area to see
          available jobs.
        </p>

      </div>
    `;

    return;
  }


  // ====================================================
  // AVAILABLE JOBS ONLY
  // ====================================================

  const {
    data: jobs,
    error
  } = await supabase
    .from("service_requests")
    .select("*")
    .eq(
      "status",
      "posted"
    )
    .eq(
      "is_active",
      true
    )
    .order("id", {
      ascending: false
    });


  if (error) {

    console.error(
      "Jobs loading error:",
      error
    );

    jobsList.innerHTML = `
      <p>
        Unable to load available jobs.
      </p>
    `;

    return;
  }


  // ====================================================
  // EXISTING PROVIDER RESPONSES
  // ====================================================

  const {
    data: existingResponses,
    error: responseLoadError
  } = await supabase
    .from("service_responses")
    .select("*")
    .eq(
      "provider_name",
      name
    );


  if (responseLoadError) {

    console.error(
      "Provider response loading error:",
      responseLoadError
    );
  }


  const respondedIds =
    new Set(
      (existingResponses || [])
        .map(response =>
          String(
            response.request_id
          )
        )
    );


  const availableJobs =
    (jobs || []).filter(
      job =>
        !respondedIds.has(
          String(job.id)
        )
    );


  let html = `
    <h3>
      Available Jobs
    </h3>
  `;


  if (
    !availableJobs.length
  ) {

    html += `
      <div class="card">

        <p>
          No new jobs available.
        </p>

      </div>
    `;
  }


  for (
    const job of availableJobs
  ) {

    html += `
      <div class="card">

        <h4>
          ${escapeHtml(
            job.service_type
          )}
        </h4>

        <p>
          <strong>
            Description:
          </strong>

          ${escapeHtml(
            job.description
          )}
        </p>

        <p>
          <strong>
            Location:
          </strong>

          ${escapeHtml(
            job.location
          )}
        </p>

        <button
          type="button"
          class="want-job-btn"
          data-request-id="${escapeHtml(
            job.id
          )}"
        >
          I want this job
        </button>

      </div>
    `;
  }


  // ====================================================
  // MY REQUESTED JOBS
  // ====================================================

  const myResponses =
    existingResponses || [];


  html += `
    <h3>
      My Requested Jobs
    </h3>
  `;


  if (!myResponses.length) {

    html += `
      <div class="card">

        <p>
          You have not requested any jobs yet.
        </p>

      </div>
    `;
  }


  for (
    const response of myResponses
  ) {

    const {
      data: job
    } = await supabase
      .from("service_requests")
      .select("*")
      .eq(
        "id",
        response.request_id
      )
      .maybeSingle();


    if (!job) continue;


    const completed =
      job.status ===
      "completed";

    const inProgress =
      job.status ===
      "in_progress";

    const accepted =
      response.status ===
      "accepted";


    let jobActions = "";


    if (
      response.status === "pending" &&
      job.status === "posted"
    ) {

      jobActions = `
        <p>
          <strong>
            Waiting for customer response.
          </strong>
        </p>
      `;
    }


    if (
      accepted &&
      job.status === "accepted"
    ) {

      jobActions = `
        <button
          type="button"
          class="start-job-btn"
          data-request-id="${escapeHtml(
            job.id
          )}"
        >
          Start Job
        </button>
      `;
    }


    if (inProgress) {

      jobActions = `
        <p>
          <strong>
            Job in progress.
          </strong>
        </p>

        <button
          type="button"
          class="complete-job-btn"
          data-request-id="${escapeHtml(
            job.id
          )}"
        >
          Complete Job
        </button>
      `;
    }


    if (completed) {

      jobActions = `
        <p>
          <strong>
            Completed
          </strong>
        </p>

        <div
          id="job-review-${escapeHtml(
            job.id
          )}"
        >
          Loading customer review...
        </div>
      `;
    }


    html += `
      <div class="card">

        <h4>
          ${escapeHtml(
            job.service_type
          )}
        </h4>

        <p>
          <strong>
            Description:
          </strong>

          ${escapeHtml(
            job.description
          )}
        </p>

        <p>
          <strong>
            Location:
          </strong>

          ${escapeHtml(
            job.location
          )}
        </p>

        <p>
          <strong>
            Your response:
          </strong>

          ${escapeHtml(
            response.status
          )}
        </p>

        <p>
          <strong>
            Job status:
          </strong>

          ${escapeHtml(
            job.status
          )}
        </p>

        ${jobActions}

      </div>
    `;
  }


  jobsList.innerHTML =
    html;


  // ====================================================
  // WANT THIS JOB
  // ====================================================

  document
    .querySelectorAll(
      ".want-job-btn"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        async () => {

          const requestId =
            button.dataset.requestId;

          button.disabled = true;


          const {
            data: currentProviderJob,
            error: currentJobError
          } = await supabase
            .from("service_requests")
            .select("*")
            .eq(
              "id",
              requestId
            )
            .maybeSingle();


          if (
            currentJobError ||
            !currentProviderJob ||
            currentProviderJob.status !== "posted" ||
            currentProviderJob.is_active !== true
          ) {

            alert(
              "This job is no longer available."
            );

            await loadJobs();

            return;
          }


          const {
            data: duplicateResponse
          } = await supabase
            .from("service_responses")
            .select("id")
            .eq(
              "request_id",
              requestId
            )
            .eq(
              "provider_name",
              name
            )
            .maybeSingle();


          if (duplicateResponse) {

            alert(
              "You have already requested this job."
            );

            await loadJobs();

            return;
          }


          const {
            error: responseError
          } = await supabase
            .from("service_responses")
            .insert({
              request_id:
                requestId,

              provider_name:
                name,

              provider_service:
                service,

              provider_location:
                area,

              status:
                "pending"
            });


          if (responseError) {

            console.error(
              "Provider response error:",
              responseError
            );

            alert(
              "Unable to request this job.\n\nDatabase error:\n" +
              responseError.message
            );

            button.disabled =
              false;

            return;
          }


          alert(
            "Job requested successfully!"
          );


          await loadJobs();
          await loadNotifications();
        }
      );
    });


  // ====================================================
  // START JOB
  // ====================================================

  document
    .querySelectorAll(
      ".start-job-btn"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        async () => {

          const requestId =
            button.dataset.requestId;

          button.disabled = true;


          const {
            error: jobError
          } = await supabase
            .from("service_requests")
            .update({
              status:
                "in_progress",

              is_active:
                false
            })
            .eq(
              "id",
              requestId
            );


          if (jobError) {

            console.error(
              jobError
            );

            alert(
              "Unable to start job."
            );

            button.disabled =
              false;

            return;
          }


          const {
            error: responseError
          } = await supabase
            .from("service_responses")
            .update({
              status:
                "in_progress"
            })
            .eq(
              "request_id",
              requestId
            )
            .eq(
              "provider_name",
              name
            );


          if (responseError) {

            console.error(
              "Provider response update error:",
              responseError
            );
          }


          await loadJobs();
          await loadNotifications();
        }
      );
    });


  // ====================================================
  // COMPLETE JOB
  // ====================================================

  document
    .querySelectorAll(
      ".complete-job-btn"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        async () => {

          const requestId =
            button.dataset.requestId;

          button.disabled = true;


          const {
            error: jobError
          } = await supabase
            .from("service_requests")
            .update({
              status:
                "completed",

              is_active:
                false
            })
            .eq(
              "id",
              requestId
            );


          if (jobError) {

            console.error(
              jobError
            );

            alert(
              "Unable to complete job."
            );

            button.disabled =
              false;

            return;
          }


          const {
            error: responseError
          } = await supabase
            .from("service_responses")
            .update({
              status:
                "completed"
            })
            .eq(
              "request_id",
              requestId
            )
            .eq(
              "provider_name",
              name
            );


          if (responseError) {

            console.error(
              "Provider response update error:",
              responseError
            );
          }


          await loadJobs();
          await loadProviderReviews();
          await loadNotifications();
        }
      );
    });


  // ====================================================
  // CUSTOMER REVIEWS FOR COMPLETED JOBS
  // ====================================================

  for (
    const response of myResponses
  ) {

    const {
      data: job
    } = await supabase
      .from("service_requests")
      .select("*")
      .eq(
        "id",
        response.request_id
      )
      .maybeSingle();


    if (
      job &&
      job.status === "completed"
    ) {

      await loadJobCustomerReview(
        job.id
      );
    }
  }
}


// ======================================================
// AUTH UI
// ======================================================

function showAuthBox() {

  showElement(authBox);

  authBox?.scrollIntoView({
    behavior: "smooth"
  });

  updateAuthForm();
}


function hideAuthBox() {

  hideElement(authBox);
}


function updateAuthButton() {

  if (!loginBtn) {
    return;
  }


  supabase.auth
    .getUser()
    .then(({ data }) => {

      if (data?.user) {

        loginBtn.textContent =
          "Account";

      } else {

        loginBtn.textContent =
          "Sign in";
      }
    });
}


function updateAuthForm() {

  if (
    !authTitle ||
    !authSubmit ||
    !switchAuth
  ) {
    return;
  }


  if (
    authMode ===
    "signup"
  ) {

    authTitle.textContent =
      "Create Account";

    authSubmit.textContent =
      "Create Account";

    switchAuth.textContent =
      "Already have an account? Sign in";

  } else {

    authTitle.textContent =
      "Sign in";

    authSubmit.textContent =
      "Sign in";

    switchAuth.textContent =
      "Create a new account";
  }
}


// ======================================================
// ACCOUNT MENU
// ======================================================

function showAccountMenu() {

  if (!authBox) return;


  authBox.innerHTML = `
    <div class="card">

      <h2>
        Account
      </h2>

      <button
        id="signOutBtn"
        type="button"
      >
        Sign out
      </button>

      <button
        id="closeAccountBtn"
        type="button"
        class="outline"
      >
        Close
      </button>

    </div>
  `;


  showElement(authBox);


  document
    .getElementById(
      "signOutBtn"
    )
    ?.addEventListener(
      "click",
      async () => {

        await supabase.auth.signOut();

        hideAuthBox();

        hideElement(services);
        hideElement(provider);
        hideElement(providerJobs);
        hideElement(jobHistory);
        hideElement(providerProfiles);
        hideElement(notifications);

        if (requestBox) {
          hideElement(requestBox);
        }

        updateAuthButton();
      }
    );


  document
    .getElementById(
      "closeAccountBtn"
    )
    ?.addEventListener(
      "click",
      () => {

        hideAuthBox();

        window.location.reload();
      }
    );
}


// ======================================================
// LOGIN BUTTON
// ======================================================

loginBtn?.addEventListener(
  "click",
  async () => {

    const {
      data: {
        user
      }
    } = await supabase.auth.getUser();


    if (user) {

      showAccountMenu();

    } else {

      showAuthBox();
    }
  }
);


// ======================================================
// SWITCH SIGN IN / SIGN UP
// ======================================================

switchAuth?.addEventListener(
  "click",
  () => {

    authMode =
      authMode === "signin"
        ? "signup"
        : "signin";

    updateAuthForm();
  }
);


// ======================================================
// CLOSE AUTH
// ======================================================

closeAuth?.addEventListener(
  "click",
  () => {

    hideAuthBox();
  }
);


// ======================================================
// AUTH SUBMIT
// ======================================================

authSubmit?.addEventListener(
  "click",
  async () => {

    const email =
      authEmail?.value.trim();

    const password =
      authPassword?.value;


    if (
      !email ||
      !password
    ) {

      if (authStatus) {

        authStatus.textContent =
          "Please enter your email and password.";
      }

      return;
    }


    if (authStatus) {

      authStatus.textContent =
        "Please wait...";
    }


    // SIGN UP
    if (
      authMode ===
      "signup"
    ) {

      const {
        data,
        error
      } = await supabase.auth.signUp({
        email,
        password
      });


      if (error) {

        console.error(error);

        if (authStatus) {

          authStatus.textContent =
            error.message;
        }

        return;
      }


      if (
        data?.user &&
        data?.session
      ) {

        await ensureCustomerProfile(
          data.user
        );


        if (authStatus) {

          authStatus.textContent =
            "Account created successfully.";
        }


        hideAuthBox();

        showElement(services);
        showElement(providerProfiles);
        showElement(jobHistory);

        await loadCustomerHistory();
        await loadLocalServiceProviders();
        await loadNotifications();

      } else {

        if (authStatus) {

          authStatus.textContent =
            "Account created. Please check your email to confirm your account, then sign in.";
        }
      }


      updateAuthButton();

      return;
    }


    // SIGN IN
    const {
      data,
      error
    } = await supabase.auth.signInWithPassword({
      email,
      password
    });


    if (error) {

      console.error(error);

      if (authStatus) {

        authStatus.textContent =
          error.message;
      }

      return;
    }


    if (data?.user) {

      await ensureCustomerProfile(
        data.user
      );
    }


    if (authStatus) {

      authStatus.textContent =
        "Signed in successfully.";
    }


    hideAuthBox();

    showElement(services);
    showElement(providerProfiles);
    showElement(jobHistory);

    await loadCustomerHistory();
    await loadLocalServiceProviders();
    await loadNotifications();

    updateAuthButton();
  }
);


// ======================================================
// AUTH STATE CHANGE
// ======================================================

supabase.auth.onAuthStateChange(
  async (
    event,
    session
  ) => {

    console.log(
      "Auth state:",
      event
    );


    updateAuthButton();


    if (!session?.user) {

      hideElement(services);
      hideElement(provider);
      hideElement(providerJobs);
      hideElement(jobHistory);
      hideElement(providerProfiles);
      hideElement(notifications);
      hideElement(requestBox);

      return;
    }


    await ensureCustomerProfile(
      session.user
    );


    showElement(services);
    showElement(providerProfiles);
    showElement(jobHistory);

    await loadCustomerHistory();
    await loadLocalServiceProviders();
    await loadNotifications();
  }
);


// ======================================================
// INITIAL LOAD
// ======================================================

async function initializeApp() {

  updateAuthForm();
  updateAuthButton();


  const {
    data: {
      session
    }
  } = await supabase.auth.getSession();


  if (session?.user) {

    await ensureCustomerProfile(
      session.user
    );

    showElement(services);
    showElement(providerProfiles);
    showElement(jobHistory);

    await loadCustomerHistory();
    await loadLocalServiceProviders();
    await loadNotifications();

  } else {

    hideElement(services);
    hideElement(provider);
    hideElement(providerJobs);
    hideElement(jobHistory);
    hideElement(providerProfiles);
    hideElement(notifications);
    hideElement(requestBox);
  }
}


initializeApp();
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js")
      .catch(error => {
        console.error("Service Worker registration failed:", error);
      });
  });
}
