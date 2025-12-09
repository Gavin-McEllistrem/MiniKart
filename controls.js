export const keyState = {};
export const touchState = { up: false, down: false, left: false, right: false };

window.addEventListener("keydown", (e) => {
  keyState[e.key.toLowerCase()] = true;
});

window.addEventListener("keyup", (e) => {
  keyState[e.key.toLowerCase()] = false;
});

export function setupTouchControls() {
  const buttons = document.querySelectorAll(".ctrl-btn");
  buttons.forEach((btn) => {
    const action = btn.dataset.action;
    const set = (val) => {
      if (action in touchState) touchState[action] = val;
    };

    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      set(true);
    });
    btn.addEventListener("pointerup", (e) => {
      e.preventDefault();
      set(false);
    });
    btn.addEventListener("pointerleave", () => set(false));
  });
}
