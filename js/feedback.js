/**
 * feedback.js — About page feedback form.
 *
 * Submits to Formspree (https://formspree.io) via fetch so the page
 * doesn't reload. Formspree natively checks the "g-recaptcha-response"
 * field produced by the Google reCAPTCHA widget below, so no separate
 * server-side verification call is needed on our end.
 *
 * SETUP REQUIRED before this goes live:
 *   1. Create a form at https://formspree.io and replace
 *      FORMSPREE_ENDPOINT below with your form's endpoint.
 *   2. Register a reCAPTCHA v2 ("I'm not a robot" checkbox) site at
 *      https://www.google.com/recaptcha/admin and replace
 *      RECAPTCHA_SITE_KEY in about.html with your site key.
 *   3. In your Formspree form settings, enable reCAPTCHA verification.
 */

const FORMSPREE_ENDPOINT = "https://formspree.io/f/REPLACE_WITH_YOUR_FORM_ID";

(() => {
  "use strict";

  const form = document.getElementById("feedback-form");
  if (!form) return;

  const statusEl = document.getElementById("form-status");
  const submitBtn = document.getElementById("feedback-submit-btn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    statusEl.textContent = "";
    statusEl.className = "form-status";

    const recaptchaResponse = form.querySelector('[name="g-recaptcha-response"]');
    if (!recaptchaResponse || !recaptchaResponse.value) {
      statusEl.textContent = "Please check the \u201cI\u2019m not a robot\u201d box before sending.";
      statusEl.classList.add("error");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form),
      });

      if (res.ok) {
        statusEl.textContent = "Thanks — your message has been sent.";
        statusEl.classList.add("success");
        form.reset();
        if (window.grecaptcha) window.grecaptcha.reset();
      } else {
        const data = await res.json().catch(() => null);
        const message =
          data && data.errors && data.errors.length
            ? data.errors.map((err) => err.message).join(", ")
            : "Something went wrong sending your message. Please try again.";
        statusEl.textContent = message;
        statusEl.classList.add("error");
      }
    } catch (err) {
      statusEl.textContent = "Couldn't reach the server. Check your connection and try again.";
      statusEl.classList.add("error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Send feedback";
    }
  });
})();
