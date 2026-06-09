(function () {
  "use strict";

  function esc(value) {
    return String(value ?? "").replace(/[&<>"]/g, c => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]
    ));
  }

  function ensureHost() {
    let host = document.getElementById("fashionDecisionHost");
    if (!host) {
      host = document.createElement("div");
      host.id = "fashionDecisionHost";
      host.className = "fashion-decision-host";
      document.body.appendChild(host);
    }
    return host;
  }

  function openDecision(options) {
    const opts = options || {};
    const host = ensureHost();
    const token = (openDecision._seq = (openDecision._seq || 0) + 1);
    host.dataset.decisionToken = String(token);
    const previousFocus = document.activeElement;
    const message = opts.message || "";
    const inputMode = opts.mode === "prompt";
    const choices = Array.isArray(opts.choices) && opts.choices.length
      ? opts.choices
      : [
          { label: opts.cancelLabel || "Cancel", value: false, kind: "cancel" },
          { label: opts.confirmLabel || "Confirm", value: true, kind: "confirm" },
        ];

    host.innerHTML = `
      <div class="fashion-decision-backdrop" data-decision-cancel></div>
      <section class="fashion-decision" role="dialog" aria-modal="true" aria-label="${esc(message)}">
        <button class="fashion-decision__close" type="button" data-decision-cancel aria-label="Cancel">x</button>
        <p class="fashion-decision__message">${esc(message)}</p>
        ${inputMode ? `<input class="fashion-decision__input" type="text" value="${esc(opts.defaultValue || "")}" aria-label="${esc(message)}">` : ""}
        <div class="fashion-decision__actions"></div>
      </section>
    `;

    const panel = host.querySelector(".fashion-decision");
    const actionHost = host.querySelector(".fashion-decision__actions");
    const input = host.querySelector(".fashion-decision__input");

    return new Promise(resolve => {
      let settled = false;
      let onHostClick;
      function settle(value) {
        if (settled) return;
        settled = true;
        host.classList.remove("is-open");
        if (onHostClick) host.removeEventListener("click", onHostClick);
        document.removeEventListener("keydown", onKeydown);
        setTimeout(() => {
          // A chained dialog (e.g. the multi-step "Add Door" flow) may have
          // reopened the shared host before this cleanup runs. Only tear down
          // if we're still the active dialog, otherwise we'd wipe the new one.
          if (host.dataset.decisionToken !== String(token)) return;
          host.innerHTML = "";
          if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
        }, 160);
        resolve(value);
      }

      choices.forEach(choice => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `fashion-decision__button${choice.kind === "confirm" ? " is-primary" : ""}`;
        button.textContent = choice.label;
        button.addEventListener("click", () => {
          if (inputMode && choice.kind === "confirm") settle(input.value);
          else settle(choice.value);
        });
        actionHost.appendChild(button);
      });

      function cancel() {
        settle(inputMode ? null : false);
      }

      function onKeydown(event) {
        if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        }
        if (event.key === "Enter" && inputMode) {
          event.preventDefault();
          settle(input.value);
        }
      }

      onHostClick = function (event) {
        if (event.target.closest("[data-decision-cancel]")) cancel();
      };

      host.addEventListener("click", onHostClick);
      document.addEventListener("keydown", onKeydown);
      requestAnimationFrame(() => host.classList.add("is-open"));
      setTimeout(() => (input || panel.querySelector(".is-primary") || panel.querySelector("button"))?.focus(), 20);
    });
  }

  window.fashionConfirm = function (message, options) {
    return openDecision({
      ...(options || {}),
      mode: "confirm",
      message,
      choices: [
        { label: options?.cancelLabel || "Cancel", value: false, kind: "cancel" },
        { label: options?.confirmLabel || "Confirm", value: true, kind: "confirm" },
      ],
    });
  };

  window.fashionPrompt = function (message, options) {
    return openDecision({
      ...(options || {}),
      mode: "prompt",
      message,
      choices: [
        { label: options?.cancelLabel || "Cancel", value: null, kind: "cancel" },
        { label: options?.confirmLabel || "Save", value: true, kind: "confirm" },
      ],
    });
  };

  window.fashionChoice = function (message, options) {
    return openDecision({
      ...(options || {}),
      mode: "choice",
      message,
      choices: options?.choices || [],
    });
  };
})();
