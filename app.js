import { supabase } from "./supabaseClient.js";

/*
==========================================================
MR AWAY FIX — COMPLETE app.js
==========================================================
This is the complete browser-side application file.

It includes:
- Supabase authentication
- Customer/provider switching
- Automatic service estimates
- Customer payment choice
- Provider registration
- Available jobs
- Provider responses
- Customer accepts/rejects provider
- Final-price proposal + customer approval
- Start / complete job
- Cash payment confirmation
- 10% MR AWAY FIX cash commission
- Provider commission balance
- Paystack online payment
- Paystack commission settlement
- Job history
- Provider profiles
- Notifications
- Provider reviews

IMPORTANT:
- Never put a Paystack secret key in this file.
- Paystack secret operations happen in Supabase Edge Functions.
==========================================================
*/

const COMMISSION_RATE = 10;

const SERVICE_RANGES = {
  Plumbing: [450, 900],
  Electrical: [450, 1000],
  Painting: [600, 2500],
  Cleaning: [300, 900],
  Gardening: [350, 1200],
  "Home Repairs": [400, 1200],
  Other: [400, 1200],
};

const $ = (id) => document.getElementById(id);

const services = $("services");
const provider = $("provider");
const providerJobs = $("providerJobs");
const requestBox = $("requestBox");
const customerBtn = $("customerBtn");
const providerBtn = $("providerBtn");

function money(value) {
  return `R${Number(value || 0).toFixed(2)}`;
}

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function errorText(error) {
  return [
    error?.message,
    error?.details,
    error?.hint,
    error?.code ? `Code: ${error.code}` : "",
  ].filter(Boolean).join("\n");
}

async function currentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error("Auth error:", error);
    return null;
  }
  return data?.user || null;
}

/* =========================================================
   AUTHENTICATION
   ========================================================= */

let authMode = "signin";

function showAuthBox(mode = "signin") {
  authMode = mode;

  $("authBox")?.classList.remove("hidden");

  if ($("authTitle")) {
    $("authTitle").textContent =
      mode === "signup" ? "Create your account" : "Sign in";
  }

  if ($("authSubmit")) {
    $("authSubmit").textContent =
      mode === "signup" ? "Create account" : "Sign in";
  }

  if ($("switchAuth")) {
    $("switchAuth").textContent =
      mode === "signup"
        ? "I already have an account"
        : "Create a new account";
  }

  if ($("authStatus")) {
    $("authStatus").textContent = "";
  }
}

function hideAuthBox() {
  $("authBox")?.classList.add("hidden");
}

async function updateAccountButton(user = null) {
  const button = $("loginBtn");
  if (!button) return;

  if (!user) {
    button.textContent = "Sign in";
    return;
  }

  button.textContent = "Account";
}

async function handleAuthSubmit() {
  const email = $("authEmail")?.value.trim();
  const password = $("authPassword")?.value;
  const status = $("authStatus");

  if (!email || !password) {
    if (status) status.textContent = "Enter your email and password.";
    return;
  }

  if (password.length < 6) {
    if (status) status.textContent = "Password must be at least 6 characters.";
    return;
  }

  if (status) status.textContent = "Please wait...";

  if (authMode === "signup") {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      if (status) status.textContent = errorText(error);
      return;
    }

    if (data?.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        role: "customer",
      });
    }

    if (status) {
      status.textContent =
        "Account created. Please check your email to confirm your account, then sign in.";
    }

    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (status) status.textContent = errorText(error);
    return;
  }

  if (data?.user) {
    await supabase.from("profiles").upsert({
      id: data.user.id,
      role: "customer",
    });
  }

  if (status) status.textContent = "Signed in successfully.";

  hideAuthBox();
  await updateAccountButton(data?.user);
  await refreshAllScreens();
}

$("loginBtn")?.addEventListener("click", async () => {
  const user = await currentUser();

  if (!user) {
    showAuthBox("signin");
    $("authEmail")?.focus();
    return;
  }

  const confirmed = window.confirm(
    "You are signed in.\n\nPress OK to sign out."
  );

  if (!confirmed) return;

  const { error } = await supabase.auth.signOut();

  if (error) {
    alert(errorText(error));
    return;
  }

  await updateAccountButton(null);
  hideAuthBox();

  if ($("authStatus")) {
    $("authStatus").textContent = "Signed out.";
  }

  alert("You have been signed out.");
});

$("authSubmit")?.addEventListener("click", handleAuthSubmit);

$("switchAuth")?.addEventListener("click", () => {
  showAuthBox(authMode === "signup" ? "signin" : "signup");
});

$("closeAuth")?.addEventListener("click", hideAuthBox);

supabase.auth.onAuthStateChange((_event, session) => {
  setTimeout(async () => {
    await updateAccountButton(session?.user || null);
    await refreshAllScreens();
  }, 250);
});

/* =========================================================
   CUSTOMER / PROVIDER MODE
   ========================================================= */

customerBtn?.addEventListener("click", async () => {
  services?.classList.remove("hidden");
  provider?.classList.add("hidden");
  providerJobs?.classList.add("hidden");

  services?.scrollIntoView({ behavior: "smooth" });

  ensureCustomerPaymentUI();
  await loadCustomerDashboard();
});

providerBtn?.addEventListener("click", async () => {
  const user = await currentUser();

  if (!user) {
    showAuthBox("signin");
    return;
  }

  services?.classList.add("hidden");
  provider?.classList.remove("hidden");
  providerJobs?.classList.remove("hidden");

  provider?.scrollIntoView({ behavior: "smooth" });

  await loadProviderDashboard();
});

/* =========================================================
   ESTIMATES
   ========================================================= */

function calculateEstimate(service, description = "") {
  let [low, high] =
    SERVICE_RANGES[service] || SERVICE_RANGES.Other;

  const text = description.toLowerCase();

  const highComplexity = [
    "replace",
    "replacement",
    "installation",
    "install",
    "rewire",
    "burst",
    "geyser",
    "roof",
    "large",
    "whole house",
    "multiple",
    "emergency",
    "urgent",
  ];

  const mediumComplexity = [
    "repair",
    "broken",
    "not working",
    "blocked",
    "damaged",
    "fix",
    "fault",
    "leak",
    "deep clean",
  ];

  if (highComplexity.some((word) => text.includes(word))) {
    low += 100;
    high += 350;
  } else if (mediumComplexity.some((word) => text.includes(word))) {
    low += 50;
    high += 180;
  }

  return {
    min: round2(low),
    max: round2(high),
    midpoint: round2((low + high) / 2),
  };
}

function ensureCustomerPaymentUI() {
  if (!requestBox) return;

  let estimateBox = $("mafEstimateBox");

  if (!estimateBox) {
    estimateBox = document.createElement("div");
    estimateBox.id = "mafEstimateBox";
    estimateBox.className = "card";
    estimateBox.style.marginTop = "15px";

    const submit = $("submitRequest");

    if (submit) {
      submit.parentElement?.insertBefore(estimateBox, submit);
    } else {
      requestBox.appendChild(estimateBox);
    }
  }

  let paymentBox = $("mafPaymentChoice");

  if (!paymentBox) {
    paymentBox = document.createElement("div");
    paymentBox.id = "mafPaymentChoice";
    paymentBox.className = "card";
    paymentBox.style.marginTop = "15px";

    paymentBox.innerHTML = `
      <h3>Payment preference</h3>

      <p>
        Choose how you expect to pay after the job is completed.
      </p>

      <label>
        <input
          type="radio"
          name="mafPaymentMethod"
          value="cash"
          checked
        >
         Pay Cash
      </label>

      <br>

      <label>
        <input
          type="radio"
          name="mafPaymentMethod"
          value="online"
        >
         Pay Online through Paystack
      </label>

      <p>
        The provider must propose the final price and you must
        approve it before the provider starts the job.
      </p>
    `;

    const description = $("description");
    const location = $("location");

    (location || description || requestBox)
      .insertAdjacentElement("afterend", paymentBox);
  }
}

function selectedPaymentMethod() {
  return (
    document.querySelector(
      'input[name="mafPaymentMethod"]:checked'
    )?.value || "cash"
  );
}

function refreshEstimate() {
  ensureCustomerPaymentUI();

  const service = requestBox?.dataset.service;
  const description = $("description")?.value.trim() || "";
  const box = $("mafEstimateBox");

  if (!service || !box) return;

  const estimate = calculateEstimate(service, description);

  if ($("jobAmount")) {
    $("jobAmount").value = estimate.midpoint;
    $("jobAmount").style.display = "none";
  }

  box.innerHTML = `
    <h3>MR AWAY FIX Estimated Cost</h3>

    <p>
      <strong>${escapeHtml(service)}</strong>
    </p>

    <p style="font-size:1.3rem;font-weight:800;">
      ${money(estimate.min)} – ${money(estimate.max)}
    </p>

    <p>
      This is an estimate based on the service and job description.
      The provider will propose the final price after assessing the job.
    </p>

    <p>
      <strong>Final price changes require your approval.</strong>
    </p>
  `;
}

/* =========================================================
   SERVICE SELECTION
   ========================================================= */

document.querySelectorAll("[data-service]").forEach((button) => {
  button.addEventListener("click", () => {
    const service = button.dataset.service;

    requestBox?.classList.remove("hidden");

    if ($("selectedService")) {
      $("selectedService").textContent =
        "Request: " + service;
    }

    if (requestBox) {
      requestBox.dataset.service = service;
      delete requestBox.dataset.requestId;
    }

    ensureCustomerPaymentUI();
    refreshEstimate();

    requestBox?.scrollIntoView({ behavior: "smooth" });
  });
});

$("description")?.addEventListener("input", refreshEstimate);

/* =========================================================
   POST CUSTOMER REQUEST
   ========================================================= */

$("submitRequest")?.addEventListener("click", async () => {
  const user = await currentUser();

  if (!user) {
    showAuthBox("signin");
    return;
  }

  const service = requestBox?.dataset.service;
  const description = $("description")?.value.trim();
  const location = $("location")?.value.trim();
  const status = $("requestStatus") || $("status");

  if (!service) {
    if (status) status.textContent = "Please choose a service.";
    return;
  }

  if (!description) {
    if (status) status.textContent = "Please describe the job.";
    return;
  }

  if (!location) {
    if (status) status.textContent = "Please enter your area.";
    return;
  }

  const estimate = calculateEstimate(service, description);
  const paymentMethod = selectedPaymentMethod();

  if (status) status.textContent = "Posting your request...";

  const { data, error } = await supabase
    .from("service_requests")
    .insert({
      customer_id: user.id,
      service_type: service,
      description,
      location,
      status: "posted",
      is_active: true,
      job_amount: estimate.midpoint,
      estimate_min: estimate.min,
      estimate_max: estimate.max,
      final_amount: null,
      final_amount_status: "estimate",
      payment_method: paymentMethod,
    })
    .select("id")
    .single();

  if (error) {
    if (status) {
      status.textContent =
        "Could not post request: " + errorText(error);
    }
    return;
  }

  requestBox.dataset.requestId = data.id;

  const ids = JSON.parse(
    localStorage.getItem("mrAwayFixCustomerRequests") || "[]"
  );

  localStorage.setItem(
    "mrAwayFixCustomerRequests",
    JSON.stringify([...new Set([...ids, data.id])])
  );

  if (status) {
    status.textContent =
      `Request posted successfully. Estimate: ${money(estimate.min)} – ${money(estimate.max)}.`;
  }

  $("description").value = "";
  $("location").value = "";

  alert(
    `Service request posted successfully!\n\n` +
    `Estimate: ${money(estimate.min)} – ${money(estimate.max)}\n` +
    `Payment preference: ${
      paymentMethod === "cash" ? "Cash" : "Online"
    }`
  );

  await loadCustomerDashboard();
});

/* =========================================================
   PROVIDER REGISTRATION
   ========================================================= */

$("saveProvider")?.addEventListener("click", async () => {
  const user = await currentUser();

  if (!user) {
    showAuthBox("signin");
    return;
  }

  const name = $("providerName")?.value.trim();
  const service = $("providerService")?.value.trim();
  const area = $("providerArea")?.value.trim();
  const status = $("providerStatus");

  if (!name || !service || !area) {
    if (status) {
      status.textContent =
        "Please enter your name/business, service and area.";
    }
    return;
  }

  if (status) status.textContent = "Saving provider...";

  const { data: existing } = await supabase
    .from("service_providers")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  let result;

  if (existing?.id) {
    result = await supabase
      .from("service_providers")
      .update({
        business_name: name,
        service_type: service,
        location: area,
        available: true,
      })
      .eq("id", existing.id);
  } else {
    result = await supabase
      .from("service_providers")
      .insert({
        user_id: user.id,
        business_name: name,
        service_type: service,
        location: area,
        available: true,
        verified: false,
      });
  }

  if (result.error) {
    if (status) {
      status.textContent =
        "Could not save provider: " +
        errorText(result.error);
    }
    return;
  }

  await supabase.from("profiles").upsert({
    id: user.id,
    role: "provider",
    full_name: name,
  });

  if (status) {
    status.textContent =
      "Provider profile saved successfully.";
  }

  await loadProviderDashboard();
});

/* =========================================================
   PROVIDER WALLET
   ========================================================= */

async function loadProviderWallet(userId) {
  const { data, error } = await supabase
    .from("provider_wallets")
    .select("*")
    .eq("provider_user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Wallet error:", error);
  }

  return data || {
    commission_owed: 0,
    total_cash_collected: 0,
    total_commission_paid: 0,
    cash_debt_limit: 500,
  };
}

/* =========================================================
   PROVIDER JOB DASHBOARD
   ========================================================= */

async function loadProviderDashboard() {
  const jobsList = $("jobsList");
  if (!jobsList) return;

  const user = await currentUser();

  if (!user) {
    jobsList.innerHTML =
      "<p>Please sign in to use the provider dashboard.</p>";
    return;
  }

  const providerName = $("providerName")?.value.trim() || "";
  const providerService =
    $("providerService")?.value.trim() || "";
  const providerArea =
    $("providerArea")?.value.trim() || "";

  if (!providerName || !providerService || !providerArea) {
    jobsList.innerHTML = `
      <div class="card">
        <h3>Provider registration</h3>
        <p>
          Enter your provider details above and press
          <strong>Register Provider</strong>.
        </p>
      </div>
    `;
    return;
  }

  jobsList.innerHTML = "<p>Loading provider dashboard...</p>";

  const wallet = await loadProviderWallet(user.id);
  const owed = Number(wallet.commission_owed || 0);
  const limit = Number(wallet.cash_debt_limit || 500);
  const cashPaused = owed >= limit;

  const { data: availableJobs, error: jobsError } =
    await supabase
      .from("service_requests")
      .select("*")
      .eq("status", "posted")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

  const { data: myResponses, error: responsesError } =
    await supabase
      .from("service_responses")
      .select("*")
      .eq("provider_user_id", user.id)
      .order("created_at", { ascending: false });

  if (responsesError) {
    console.error("Provider response error:", responsesError);
  }

  const responses = myResponses || [];
  const responseMap = {};

  responses.forEach((response) => {
    responseMap[response.request_id] = response;
  });

  let html = `
    <div class="card">
      <h2>Provider Wallet</h2>

      <p>
        <strong>Commission owed:</strong>
        ${money(owed)}
      </p>

      <p>
        <strong>Total cash collected:</strong>
        ${money(wallet.total_cash_collected)}
      </p>

      <p>
        <strong>Total commission paid:</strong>
        ${money(wallet.total_commission_paid)}
      </p>

      <p>
        <strong>Cash-job limit:</strong>
        ${money(limit)}
      </p>

      ${
        cashPaused
          ? `
            <div class="card">
              <p>
                 Cash jobs are temporarily paused because
                your outstanding MR AWAY FIX commission has
                reached the limit.
              </p>

              <button
                type="button"
                id="mafSettleCommission"
              >
                Pay Outstanding Commission
              </button>
            </div>
          `
          : owed > 0
          ? `
            <button
              type="button"
              id="mafSettleCommission"
              class="outline"
            >
              Pay Commission Balance
            </button>
          `
          : `
            <p> No outstanding commission balance.</p>
          `
      }
    </div>

    <h2>Available Jobs</h2>
  `;

  if (jobsError) {
    html += `
      <div class="card">
        <p>Could not load available jobs.</p>
        <small>${escapeHtml(errorText(jobsError))}</small>
      </div>
    `;
  } else {
    const freshJobs = (availableJobs || []).filter(
      (job) => !responseMap[job.id]
    );

    if (!freshJobs.length) {
      html += `
        <div class="card">
          <p>No new jobs available right now.</p>
        </div>
      `;
    }

    freshJobs.forEach((job) => {
      const cashJob = job.payment_method === "cash";

      html += `
        <div class="job-card">

          <h3> ${escapeHtml(job.service_type)}</h3>

          <p>
            ${escapeHtml(job.description)}
          </p>

          <p>
             ${escapeHtml(job.location)}
          </p>

          <p>
            <strong>MR AWAY FIX estimate:</strong>
            ${money(job.estimate_min || job.job_amount)}
            –
            ${money(job.estimate_max || job.job_amount)}
          </p>

          <p>
            <strong>Payment:</strong>
            ${cashJob ? " CASH" : " ONLINE"}
          </p>

          ${
            cashJob && cashPaused
              ? `
                <p>
                   Cash jobs are unavailable until your
                  commission balance is settled.
                </p>
              `
              : `
                <button
                  type="button"
                  class="mafTakeJob"
                  data-request-id="${escapeHtml(job.id)}"
                >
                  I want this job
                </button>
              `
          }

        </div>
      `;
    });
  }

  html += `
    <h2 style="margin-top:30px;">
      My Jobs
    </h2>
  `;

  if (!responses.length) {
    html += `
      <div class="card">
        <p>You have not requested any jobs yet.</p>
      </div>
    `;
  }

  for (const response of responses) {
    const { data: job } = await supabase
      .from("service_requests")
      .select("*")
      .eq("id", response.request_id)
      .maybeSingle();

    if (!job) continue;

    const { data: payment } = await supabase
      .from("job_payments")
      .select("*")
      .eq("request_id", job.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const cashJob = job.payment_method === "cash";

    html += `
      <div class="job-card">

        <h3> ${escapeHtml(job.service_type)}</h3>

        <p>${escapeHtml(job.description)}</p>

        <p> ${escapeHtml(job.location)}</p>

        <p>
          <strong>Estimate:</strong>
          ${money(job.estimate_min || job.job_amount)}
          –
          ${money(job.estimate_max || job.job_amount)}
        </p>

        ${
          job.final_amount
            ? `
              <p>
                <strong>Final amount:</strong>
                ${money(job.final_amount)}
              </p>
            `
            : ""
        }

        <p>
          <strong>Payment:</strong>
          ${cashJob ? " Cash" : " Online"}
        </p>

        <p>
          <strong>Your response:</strong>
          ${escapeHtml(response.status)}
        </p>

        <p>
          <strong>Job status:</strong>
          ${escapeHtml(job.status)}
        </p>
    `;

    if (
      response.status === "pending" &&
      job.status === "posted"
    ) {
      html += `
        <p>
          Waiting for the customer to choose a provider.
        </p>
      `;
    }

    if (
      response.status === "accepted" &&
      job.status === "accepted"
    ) {
      if (job.final_amount_status === "customer_approved") {
        html += `
          <div class="card">
            <p>
              Customer approved final price:
              <strong>${money(job.final_amount)}</strong>
            </p>

            <button
              type="button"
              class="mafStartJob"
              data-request-id="${escapeHtml(job.id)}"
            >
              Start Job
            </button>
          </div>
        `;
      } else {
        html += `
          <div class="card">
            <h4>Final Price</h4>

            <p>
              Enter the final amount after assessing the job.
            </p>

            <input
              type="number"
              min="1"
              step="0.01"
              class="mafFinalPrice"
              data-request-id="${escapeHtml(job.id)}"
              value="${escapeHtml(
                job.final_amount ||
                job.estimate_min ||
                job.job_amount ||
                ""
              )}"
            >

            <button
              type="button"
              class="mafProposePrice"
              data-request-id="${escapeHtml(job.id)}"
            >
              Send Final Price to Customer
            </button>
          </div>
        `;
      }
    }

    if (
      response.status === "in_progress" &&
      job.status === "in_progress"
    ) {
      html += `
        <button
          type="button"
          class="mafCompleteJob"
          data-request-id="${escapeHtml(job.id)}"
        >
          Complete Job
        </button>
      `;
    }

    if (job.status === "completed") {
      if (payment?.payment_status === "paid") {
        html += `
          <div class="card">
            <p>
              <strong>Payment received.</strong>
            </p>

            <p>
              ${
                cashJob
                  ? `Cash received. MR AWAY FIX commission: ${money(
                      payment.commission_amount
                    )}`
                  : "Paid through Paystack."
              }
            </p>
          </div>
        `;
      } else if (
        cashJob &&
        payment?.payment_status === "pending"
      ) {
        html += `
          <div class="card">
            <h4>Cash Payment</h4>

            <p>
              Customer has selected cash and marked the
              cash payment as ready.
            </p>

            <p>
              <strong>Cash amount:</strong>
              ${money(payment.job_amount)}
            </p>

            <button
              type="button"
              class="mafConfirmCash"
              data-request-id="${escapeHtml(job.id)}"
            >
              Confirm Cash Received
            </button>
          </div>
        `;
      } else if (cashJob) {
        html += `
          <div class="card">
            <p>
              Waiting for the customer to mark the cash
              payment as ready.
            </p>
          </div>
        `;
      } else {
        html += `
          <div class="card">
            <p>
              Waiting for Paystack payment confirmation.
            </p>
          </div>
        `;
      }
    }

    html += `</div>`;
  }

  jobsList.innerHTML = html;

  bindProviderButtons(user);
}

/* =========================================================
   PROVIDER ACTIONS
   ========================================================= */

function bindProviderButtons(user) {
  $("mafSettleCommission")?.addEventListener(
    "click",
    async (event) => {
      const button = event.currentTarget;

      button.disabled = true;
      button.textContent = "Preparing payment...";

      const { data, error } =
        await supabase.functions.invoke(
          "create-commission-payment",
          { body: {} }
        );

      if (error || !data?.authorization_url) {
        alert(
          error?.message ||
            data?.error ||
            "Unable to start commission payment."
        );

        button.disabled = false;
        button.textContent = "Pay Commission Balance";
        return;
      }

      window.location.href = data.authorization_url;
    }
  );

  document
    .querySelectorAll(".mafTakeJob")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;

        const requestId = button.dataset.requestId;

        const name =
          $("providerName")?.value.trim();
        const service =
          $("providerService")?.value.trim();
        const area =
          $("providerArea")?.value.trim();

        if (!name || !service || !area) {
          alert("Please register your provider details first.");
          button.disabled = false;
          return;
        }

        const { data: existing } = await supabase
          .from("service_responses")
          .select("id")
          .eq("request_id", requestId)
          .eq("provider_user_id", user.id)
          .limit(1);

        if (existing?.length) {
          alert("You have already requested this job.");
          return;
        }

        const { error } = await supabase
          .from("service_responses")
          .insert({
            request_id: requestId,
            provider_user_id: user.id,
            provider_name: name,
            provider_service: service,
            provider_location: area,
            status: "pending",
          });

        if (error) {
          alert(
            errorText(error).toLowerCase().includes("row-level")
              ? "This cash job may be paused because your commission balance has reached the cash-job limit."
              : errorText(error)
          );

          button.disabled = false;
          return;
        }

        alert("Job requested successfully.");
        await loadProviderDashboard();
      });
    });

  document
    .querySelectorAll(".mafProposePrice")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;

        const input = document.querySelector(
          `.mafFinalPrice[data-request-id="${CSS.escape(
            button.dataset.requestId
          )}"]`
        );

        const amount = Number(input?.value);

        if (!Number.isFinite(amount) || amount <= 0) {
          alert("Enter a valid final price.");
          button.disabled = false;
          return;
        }

        const { data, error } = await supabase.rpc(
          "propose_final_price",
          {
            p_request_id: button.dataset.requestId,
            p_amount: amount,
          }
        );

        if (error) {
          alert(errorText(error));
          button.disabled = false;
          return;
        }

        alert(
          `Final price ${money(
            data.final_amount
          )} sent to the customer for approval.`
        );

        await loadProviderDashboard();
        await loadCustomerDashboard();
      });
    });

  document
    .querySelectorAll(".mafStartJob")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;

        const requestId = button.dataset.requestId;

        const { data: response } = await supabase
          .from("service_responses")
          .select("id")
          .eq("request_id", requestId)
          .eq("provider_user_id", user.id)
          .eq("status", "accepted")
          .maybeSingle();

        if (!response) {
          alert(
            "This job is not assigned to your provider account."
          );
          button.disabled = false;
          return;
        }

        const { error: jobError } = await supabase
          .from("service_requests")
          .update({
            status: "in_progress",
            is_active: false,
          })
          .eq("id", requestId);

        if (jobError) {
          alert(errorText(jobError));
          button.disabled = false;
          return;
        }

        const { error: responseError } = await supabase
          .from("service_responses")
          .update({ status: "in_progress" })
          .eq("request_id", requestId)
          .eq("provider_user_id", user.id);

        if (responseError) {
          alert(errorText(responseError));
          return;
        }

        alert("Job started.");
        await loadProviderDashboard();
      });
    });

  document
    .querySelectorAll(".mafCompleteJob")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;

        const requestId = button.dataset.requestId;

        const { data: response } = await supabase
          .from("service_responses")
          .select("id")
          .eq("request_id", requestId)
          .eq("provider_user_id", user.id)
          .eq("status", "in_progress")
          .maybeSingle();

        if (!response) {
          alert(
            "This job is not assigned to your provider account."
          );
          button.disabled = false;
          return;
        }

        const { data: job } = await supabase
          .from("service_requests")
          .select("final_amount, job_amount")
          .eq("id", requestId)
          .maybeSingle();

        const amount =
          Number(job?.final_amount || job?.job_amount || 0);

        if (!amount || amount <= 0) {
          alert("This job does not have a valid final amount.");
          button.disabled = false;
          return;
        }

        const { error: jobError } = await supabase
          .from("service_requests")
          .update({
            status: "completed",
            is_active: false,
          })
          .eq("id", requestId);

        if (jobError) {
          alert(errorText(jobError));
          button.disabled = false;
          return;
        }

        const { error: responseError } = await supabase
          .from("service_responses")
          .update({ status: "completed" })
          .eq("request_id", requestId)
          .eq("provider_user_id", user.id);

        if (responseError) {
          alert(errorText(responseError));
          return;
        }

        alert("Job completed.");
        await loadProviderDashboard();
        await loadCustomerDashboard();
      });
    });

  document
    .querySelectorAll(".mafConfirmCash")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        button.textContent = "Confirming...";

        const { data, error } = await supabase.rpc(
          "confirm_cash_payment",
          {
            p_request_id: button.dataset.requestId,
          }
        );

        if (error) {
          alert(errorText(error));
          button.disabled = false;
          button.textContent = "Confirm Cash Received";
          return;
        }

        alert(
          `Cash payment confirmed.\n\n` +
          `Cash collected: ${money(data.job_amount)}\n` +
          `MR AWAY FIX commission: ${money(data.commission)}\n` +
          `Provider amount: ${money(data.provider_amount)}`
        );

        await loadProviderDashboard();
        await loadCustomerDashboard();
      });
    });
}

/* =========================================================
   CUSTOMER DASHBOARD
   ========================================================= */

async function loadCustomerDashboard() {
  const customerResponses = $("customerResponses");

  if (!customerResponses) return;

  const user = await currentUser();

  if (!user) {
    customerResponses.classList.add("hidden");
    return;
  }

  const { data: jobs, error } = await supabase
    .from("service_requests")
    .select("*")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    customerResponses.classList.remove("hidden");
    customerResponses.innerHTML = `
      <div class="card">
        <p>Could not load your requests.</p>
        <small>${escapeHtml(errorText(error))}</small>
      </div>
    `;
    return;
  }

  customerResponses.classList.remove("hidden");

  if (!jobs?.length) {
    customerResponses.innerHTML = `
      <div class="card">
        <h3>Your Requests</h3>
        <p>You have not posted a service request yet.</p>
      </div>
    `;
    return;
  }

  let html = `
    <h2>Your Service Requests</h2>
  `;

  for (const job of jobs) {
    const { data: responses } = await supabase
      .from("service_responses")
      .select("*")
      .eq("request_id", job.id)
      .order("created_at", { ascending: false });

    const { data: payment } = await supabase
      .from("job_payments")
      .select("*")
      .eq("request_id", job.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const estimateText =
      job.estimate_min != null && job.estimate_max != null
        ? `${money(job.estimate_min)} – ${money(job.estimate_max)}`
        : money(job.job_amount);

    html += `
      <div class="card">

        <h3>
          ${escapeHtml(job.service_type)}
        </h3>

        <p>
          <strong>Description:</strong>
          ${escapeHtml(job.description)}
        </p>

        <p>
          <strong>Location:</strong>
          ${escapeHtml(job.location)}
        </p>

        <p>
          <strong>Estimate:</strong>
          ${estimateText}
        </p>

        ${
          job.final_amount
            ? `
              <p>
                <strong>Final amount:</strong>
                ${money(job.final_amount)}
              </p>
            `
            : ""
        }

        <p>
          <strong>Payment method:</strong>
          ${
            job.payment_method === "cash"
              ? " Cash"
              : " Online"
          }
        </p>

        <p>
          <strong>Job status:</strong>
          ${escapeHtml(job.status)}
        </p>
    `;

    if (job.final_amount_status === "provider_proposed") {
      html += `
        <div class="card">
          <h4>Final Price Approval</h4>

          <p>
            Provider proposed:
            <strong>${money(job.final_amount)}</strong>
          </p>

          <button
            type="button"
            class="mafApprovePrice"
            data-request-id="${escapeHtml(job.id)}"
          >
            Approve Final Price
          </button>

          <button
            type="button"
            class="mafRejectPrice outline"
            data-request-id="${escapeHtml(job.id)}"
          >
            Reject / Ask Provider to Reprice
          </button>
        </div>
      `;
    }

    if (job.final_amount_status === "customer_approved") {
      html += `
        <div class="card">
          <p>
             Final price approved:
            <strong>${money(job.final_amount)}</strong>
          </p>
        </div>
      `;
    }

    html += `
      <h4>Provider Responses</h4>
    `;

    if (!responses?.length) {
      html += `
        <p>
          Waiting for providers to respond.
        </p>
      `;
    }

    for (const response of responses || []) {
      html += `
        <div class="card">

          <h4>
             ${escapeHtml(
              response.provider_name || "Provider"
            )}
          </h4>

          <p>
            Service:
            ${escapeHtml(response.provider_service)}
          </p>

          <p>
             ${escapeHtml(response.provider_location)}
          </p>

          <p>
            <strong>Response:</strong>
            ${escapeHtml(response.status)}
          </p>
      `;

      if (
        response.status === "pending" &&
        job.status === "posted"
      ) {
        html += `
          <button
            type="button"
            class="mafAcceptProvider"
            data-response-id="${escapeHtml(response.id)}"
            data-request-id="${escapeHtml(job.id)}"
          >
             Accept Provider
          </button>

          <button
            type="button"
            class="mafRejectProvider outline"
            data-response-id="${escapeHtml(response.id)}"
          >
             Reject
          </button>
        `;
      }

      html += `</div>`;
    }

    /* PAYMENT */
    if (job.status === "completed") {
      if (payment?.payment_status === "paid") {
        html += `
          <div class="card">
            <h4>Payment</h4>
            <p>
               Payment received.
            </p>
            <p>
              Method:
              ${escapeHtml(payment.payment_method)}
            </p>
          </div>
        `;
      } else if (job.payment_method === "cash") {
        if (payment?.payment_status === "pending") {
          html += `
            <div class="card">
              <h4> Cash Payment Pending</h4>

              <p>
                Hand the cash to the provider.
                The provider must confirm receipt.
              </p>

              <p>
                <strong>Amount:</strong>
                ${money(
                  payment.job_amount ||
                    job.final_amount ||
                    job.job_amount
                )}
              </p>

              <button
                type="button"
                class="mafCancelCash outline"
                data-request-id="${escapeHtml(job.id)}"
              >
                Cancel Cash Payment Request
              </button>
            </div>
          `;
        } else {
          html += `
            <div class="card">
              <h4> Pay Cash</h4>

              <p>
                Pay the provider the final approved amount.
              </p>

              <p>
                <strong>Amount:</strong>
                ${money(job.final_amount || job.job_amount)}
              </p>

              <button
                type="button"
                class="mafRequestCash"
                data-request-id="${escapeHtml(job.id)}"
              >
                I Will Pay Cash
              </button>
            </div>
          `;
        }
      } else {
        html += `
          <div class="card">
            <h4> Online Payment</h4>

            <p>
              Pay securely through Paystack.
            </p>

            <button
              type="button"
              class="mafPayOnline"
              data-request-id="${escapeHtml(job.id)}"
            >
              Pay ${money(job.final_amount || job.job_amount)} Online
            </button>
          </div>
        `;
      }
    }

    /* REVIEW */
    if (
      job.status === "completed" &&
      payment?.payment_status === "paid"
    ) {
      const { data: review } = await supabase
        .from("service_reviews")
        .select("id")
        .eq("request_id", job.id)
        .limit(1)
        .maybeSingle();

      if (!review) {
        html += `
          <div class="card">
            <h4>Rate this provider</h4>

            <select
              class="mafRating"
              data-request-id="${escapeHtml(job.id)}"
            >
              <option value="">Choose rating</option>
              <option value="5"> 5</option>
              <option value="4"> 4</option>
              <option value="3"> 3</option>
              <option value="2"> 2</option>
              <option value="1"> 1</option>
            </select>

            <textarea
              class="mafReview"
              data-request-id="${escapeHtml(job.id)}"
              placeholder="Write a review (optional)"
            ></textarea>

            <button
              type="button"
              class="mafSubmitReview"
              data-request-id="${escapeHtml(job.id)}"
            >
              Submit Review
            </button>
          </div>
        `;
      } else {
        html += `
          <p>
             You have already reviewed this provider.
          </p>
        `;
      }
    }

    html += `</div>`;
  }

  customerResponses.innerHTML = html;

  bindCustomerButtons(user);
}

/* =========================================================
   CUSTOMER ACTIONS
   ========================================================= */

function bindCustomerButtons(user) {
  document
    .querySelectorAll(".mafAcceptProvider")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;

        const requestId = button.dataset.requestId;
        const responseId = button.dataset.responseId;

        const { data: response } = await supabase
          .from("service_responses")
          .select("provider_user_id, provider_name")
          .eq("id", responseId)
          .eq("request_id", requestId)
          .maybeSingle();

        if (!response) {
          alert("Provider response not found.");
          button.disabled = false;
          return;
        }

        const { error: responseError } = await supabase
          .from("service_responses")
          .update({ status: "accepted" })
          .eq("id", responseId)
          .eq("request_id", requestId);

        if (responseError) {
          alert(errorText(responseError));
          button.disabled = false;
          return;
        }

        const { error: rejectError } = await supabase
          .from("service_responses")
          .update({ status: "rejected" })
          .eq("request_id", requestId)
          .eq("status", "pending")
          .neq("id", responseId);

        if (rejectError) {
          console.warn("Could not reject other responses:", rejectError);
        }

        const { error: jobError } = await supabase
          .from("service_requests")
          .update({
            status: "accepted",
            provider_id: response.provider_user_id || null,
            is_active: false,
          })
          .eq("id", requestId)
          .eq("customer_id", user.id);

        if (jobError) {
          alert(errorText(jobError));
          return;
        }

        alert(
          `Provider ${response.provider_name || ""} accepted successfully.`
        );

        await loadCustomerDashboard();
      });
    });

  document
    .querySelectorAll(".mafRejectProvider")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;

        const { error } = await supabase
          .from("service_responses")
          .update({ status: "rejected" })
          .eq("id", button.dataset.responseId);

        if (error) {
          alert(errorText(error));
          button.disabled = false;
          return;
        }

        await loadCustomerDashboard();
      });
    });

  document
    .querySelectorAll(".mafApprovePrice")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;

        const { data, error } = await supabase.rpc(
          "approve_final_price",
          {
            p_request_id: button.dataset.requestId,
            p_approve: true,
          }
        );

        if (error) {
          alert(errorText(error));
          button.disabled = false;
          return;
        }

        alert(
          `Final price approved: ${money(data.final_amount)}`
        );

        await loadCustomerDashboard();
        await loadProviderDashboard();
      });
    });

  document
    .querySelectorAll(".mafRejectPrice")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;

        const { error } = await supabase.rpc(
          "approve_final_price",
          {
            p_request_id: button.dataset.requestId,
            p_approve: false,
          }
        );

        if (error) {
          alert(errorText(error));
          button.disabled = false;
          return;
        }

        alert(
          "The final price was rejected. The provider can propose another price."
        );

        await loadCustomerDashboard();
      });
    });

  document
    .querySelectorAll(".mafRequestCash")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;

        const { data, error } = await supabase.rpc(
          "request_cash_payment",
          {
            p_request_id: button.dataset.requestId,
          }
        );

        if (error) {
          alert(errorText(error));
          button.disabled = false;
          return;
        }

        alert(
          `Cash payment marked as pending.\n\n` +
          `Amount: ${money(data.amount)}\n` +
          `MR AWAY FIX commission: ${money(data.commission)}`
        );

        await loadCustomerDashboard();
      });
    });

  document
    .querySelectorAll(".mafCancelCash")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;

        const { error } = await supabase.rpc(
          "cancel_cash_payment",
          {
            p_request_id: button.dataset.requestId,
          }
        );

        if (error) {
          alert(errorText(error));
          button.disabled = false;
          return;
        }

        await loadCustomerDashboard();
      });
    });

  document
    .querySelectorAll(".mafPayOnline")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        button.textContent = "Opening Paystack...";

        const { data, error } =
          await supabase.functions.invoke(
            "create-paystack-payment",
            {
              body: {
                request_id: button.dataset.requestId,
              },
            }
          );

        if (error || !data?.authorization_url) {
          alert(
            error?.message ||
              data?.error ||
              "Unable to start Paystack payment."
          );

          button.disabled = false;
          button.textContent = "Pay Online";
          return;
        }

        window.location.href = data.authorization_url;
      });
    });

  document
    .querySelectorAll(".mafSubmitReview")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;

        const requestId = button.dataset.requestId;

        const rating = Number(
          document.querySelector(
            `.mafRating[data-request-id="${CSS.escape(requestId)}"]`
          )?.value
        );

        const review = document.querySelector(
          `.mafReview[data-request-id="${CSS.escape(requestId)}"]`
        )?.value.trim() || "";

        if (!rating || rating < 1 || rating > 5) {
          alert("Please choose a rating from 1 to 5.");
          button.disabled = false;
          return;
        }

        const { data: providerResponse } = await supabase
          .from("service_responses")
          .select("provider_name")
          .eq("request_id", requestId)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!providerResponse) {
          alert("Provider information could not be found.");
          button.disabled = false;
          return;
        }

        const { error } = await supabase
          .from("service_reviews")
          .insert({
            request_id: requestId,
            provider_name: providerResponse.provider_name,
            rating,
            review,
          });

        if (error) {
          alert(errorText(error));
          button.disabled = false;
          return;
        }

        alert("Thank you. Your review has been submitted.");
        await loadCustomerDashboard();
      });
    });
}

/* =========================================================
   PROVIDER PROFILES
   ========================================================= */

async function loadProviderProfiles() {
  const box = $("providerProfiles");
  const list = $("providerProfilesList");

  if (!box || !list) return;

  const { data, error } = await supabase
    .from("service_providers")
    .select(
      "id, user_id, business_name, service_type, description, location, verified, available"
    )
    .eq("available", true)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    list.innerHTML = `
      <p>Could not load providers.</p>
      <small>${escapeHtml(errorText(error))}</small>
    `;
    return;
  }

  box.classList.remove("hidden");

  if (!data?.length) {
    list.innerHTML =
      "<p>No local service providers are registered yet.</p>";
    return;
  }

  list.innerHTML = data
    .map(
      (item) => `
        <div class="card">

          <h3>
             ${escapeHtml(
              item.business_name || "Service Provider"
            )}
          </h3>

          <p>
            <strong>Service:</strong>
            ${escapeHtml(item.service_type || "")}
          </p>

          <p>
            <strong>Area:</strong>
            ${escapeHtml(item.location || "")}
          </p>

          ${
            item.description
              ? `<p>${escapeHtml(item.description)}</p>`
              : ""
          }

          <p>
            ${
              item.verified
                ? " Verified provider"
                : "Provider verification pending"
            }
          </p>

        </div>
      `
    )
    .join("");
}

/* =========================================================
   JOB HISTORY
   ========================================================= */

async function loadJobHistory() {
  const box = $("jobHistory");
  const list = $("historyList");

  if (!box || !list) return;

  const user = await currentUser();
  if (!user) {
    box.classList.add("hidden");
    return;
  }

  const { data: customerJobs } = await supabase
    .from("service_requests")
    .select("*")
    .eq("customer_id", user.id)
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  const { data: providerResponses } = await supabase
    .from("service_responses")
    .select("*")
    .eq("provider_user_id", user.id)
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  const providerRequestIds = (providerResponses || [])
    .map((row) => row.request_id)
    .filter(Boolean);

  let providerJobs = [];

  if (providerRequestIds.length) {
    const { data } = await supabase
      .from("service_requests")
      .select("*")
      .in("id", providerRequestIds);

    providerJobs = data || [];
  }

  const all = [
    ...(customerJobs || []).map((job) => ({
      ...job,
      historyRole: "Customer",
    })),
    ...providerJobs.map((job) => ({
      ...job,
      historyRole: "Provider",
    })),
  ];

  box.classList.remove("hidden");

  if (!all.length) {
    list.innerHTML =
      "<p>No completed jobs yet.</p>";
    return;
  }

  list.innerHTML = all
    .map(
      (job) => `
        <div class="card">

          <h3>
            ${escapeHtml(job.service_type)}
          </h3>

          <p>
            ${escapeHtml(job.description)}
          </p>

          <p>
             ${escapeHtml(job.location)}
          </p>

          <p>
            <strong>Role:</strong>
            ${escapeHtml(job.historyRole)}
          </p>

          <p>
            <strong>Final amount:</strong>
            ${money(job.final_amount || job.job_amount)}
          </p>

          <p>
            <strong>Status:</strong>
            Completed
          </p>

        </div>
      `
    )
    .join("");
}

/* =========================================================
   NOTIFICATIONS
   ========================================================= */

async function loadNotifications() {
  const box = $("notifications");
  const list = $("notificationsList");

  if (!box || !list) return;

  const user = await currentUser();
  if (!user) {
    box.classList.add("hidden");
    return;
  }

  const notifications = [];

  const { data: customerJobs } = await supabase
    .from("service_requests")
    .select("*")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  for (const job of customerJobs || []) {
    if (job.status === "completed") {
      notifications.push(
        `Your ${job.service_type} job has been completed.`
      );
    }

    if (job.final_amount_status === "provider_proposed") {
      notifications.push(
        `A provider has proposed a final price of ${money(
          job.final_amount
        )} for your ${job.service_type} job.`
      );
    }

    const { data: responses } = await supabase
      .from("service_responses")
      .select("provider_name,status")
      .eq("request_id", job.id);

    for (const response of responses || []) {
      if (response.status === "pending") {
        notifications.push(
          `${response.provider_name} responded to your ${job.service_type} request.`
        );
      }

      if (response.status === "accepted") {
        notifications.push(
          `${response.provider_name} was accepted for your ${job.service_type} job.`
        );
      }
    }
  }

  const { data: providerResponses } = await supabase
    .from("service_responses")
    .select("request_id,provider_name,status")
    .eq("provider_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  for (const response of providerResponses || []) {
    if (response.status === "accepted") {
      notifications.push(
        `You were accepted for a job.`
      );
    }

    if (response.status === "rejected") {
      notifications.push(
        `A customer rejected your job response.`
      );
    }
  }

  box.classList.remove("hidden");

  if (!notifications.length) {
    list.innerHTML =
      "<p>No new notifications.</p>";
    return;
  }

  list.innerHTML = notifications
    .slice(0, 20)
    .map(
      (message) => `
        <div class="card">
          <p> ${escapeHtml(message)}</p>
        </div>
      `
    )
    .join("");
}

/* =========================================================
   REVIEWS / PROVIDER REVIEW SUMMARY
   ========================================================= */

async function loadProviderReviews() {
  const box = $("providerReviews");

  if (!box) return;

  const { data: reviews, error } = await supabase
    .from("service_reviews")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Review loading error:", error);
    return;
  }

  if (!reviews?.length) {
    box.innerHTML = `
      <h3>Customer Reviews</h3>
      <p>No reviews yet.</p>
    `;
    return;
  }

  box.innerHTML = `
    <h3>Customer Reviews</h3>

    ${reviews
      .map(
        (review) => `
          <div class="card">
            <p>
              <strong>${escapeHtml(
                review.provider_name
              )}</strong>
            </p>

            <p>
              ${"".repeat(
                Math.max(
                  1,
                  Math.min(5, Number(review.rating))
                )
              )}
            </p>

            ${
              review.review
                ? `<p>${escapeHtml(review.review)}</p>`
                : ""
            }
          </div>
        `
      )
      .join("")}
  `;
}

/* =========================================================
   REFRESH
   ========================================================= */

async function refreshAllScreens() {
  const user = await currentUser();

  await updateAccountButton(user);

  if (!user) return;

  ensureCustomerPaymentUI();

  await Promise.allSettled([
    loadCustomerDashboard(),
    loadProviderProfiles(),
    loadJobHistory(),
    loadNotifications(),
    loadProviderReviews(),
  ]);

  if (
    provider &&
    !provider.classList.contains("hidden")
  ) {
    await loadProviderDashboard();
  }
}

/* =========================================================
   INITIALIZATION
   ========================================================= */

(async function initializeMRAwayFix() {
  ensureCustomerPaymentUI();

  const user = await currentUser();

  await updateAccountButton(user);

  if (user) {
    await refreshAllScreens();
  }

  console.log(
    "MR AWAY FIX COMPLETE APP.JS LOADED — MARKETPLACE VERSION"
  );
})();
