const STATES = Object.freeze({
  SLEEPING: "sleeping",
  WAKING: "waking",
  COUNTDOWN: "countdown",
  PLAYING: "playing",
  VICTORY: "victory",
  DEFEAT: "defeat",
  CLICK_READY: "click-ready",
  CLICK_TEST: "click-test",
  CLICK_RESULT: "click-result",
});

const MIN_TARGET_SECOND = 7;
const MAX_TARGET_SECOND = 12;
const MAX_SECOND = 15;
const INACTIVITY_MS = 2 * 60 * 1000;
const EXPRESSION_INTERVAL_MS = 1800;
const LONG_PRESS_MS = 5000;
const CLICK_TEST_DURATION_MS = 5000;
const CLICK_RESULT_LOCK_MS = 2000;
const TIMER_RESULT_LOCK_MS = 2000;
const COUNTDOWN_STEP_MS = 850;

const robot = document.querySelector("#robot");
const message = document.querySelector("#message");
const instruction = document.querySelector("#instruction");
const counter = document.querySelector("#counter");
const animalResult = document.querySelector("#animal-result");

let state = STATES.SLEEPING;
let elapsedMs = 0;
let startTime = 0;
let animationFrame = null;
let expressionTimer = null;
let transitionTimer = null;
let inactivityTimer = null;
let targetSecond = null;
let clickCount = 0;
let clickTestStart = 0;
let modePressTimer = null;
let inputLockedUntil = 0;
let countdownValue = 3;
let spaceReleasedForCps = true;

function clearStateTimers() {
  cancelAnimationFrame(animationFrame);
  clearInterval(expressionTimer);
  clearTimeout(transitionTimer);
  clearTimeout(modePressTimer);

  animationFrame = null;
  expressionTimer = null;
  transitionTimer = null;
  modePressTimer = null;
}

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    setState(STATES.SLEEPING);
  }, INACTIVITY_MS);
}

function setText(text, hint) {
  message.textContent = text;

  if (hint) {
    instruction.innerHTML = `<span class="key-icon">BOTÃO</span>${hint}`;
  } else {
    instruction.innerHTML = "";
  }
}

function getSeconds(milliseconds) {
  return Math.floor(milliseconds / 1000);
}

function formatTime(milliseconds) {
  return (milliseconds / 1000).toFixed(2).padStart(5, "0");
}

function getDisplayedTime(milliseconds) {
  return Number((milliseconds / 1000).toFixed(2));
}

function drawTarget() {
  const previousTarget = targetSecond;

  do {
    targetSecond = Math.floor(Math.random() * (MAX_TARGET_SECOND - MIN_TARGET_SECOND + 1)) + MIN_TARGET_SECOND;
  } while (previousTarget !== null && targetSecond === previousTarget);
}

function getAnimalForCps(cps) {
  if (cps < 2) return { icon: "🐢", name: "TARTARUGA" };
  if (cps < 4) return { icon: "🐱", name: "GATO" };
  if (cps < 6) return { icon: "🐇", name: "COELHO" };
  if (cps < 8) return { icon: "🐆", name: "GUEPARDO" };
  return { icon: "🦅", name: "FALCÃO" };
}

function rotateExpressions(expressions) {
  let index = 0;
  robot.dataset.expression = expressions[index];

  expressionTimer = setInterval(() => {
    index = (index + 1) % expressions.length;
    robot.dataset.expression = expressions[index];
  }, EXPRESSION_INTERVAL_MS);
}

function updateTimer(now) {
  elapsedMs = now - startTime;

  const seconds = getSeconds(elapsedMs);
  counter.textContent = formatTime(elapsedMs);

  if (seconds >= MAX_SECOND) {
    setState(STATES.DEFEAT);
    return;
  }

  animationFrame = requestAnimationFrame(updateTimer);
}

function updateClickTest(now) {
  const clickElapsed = now - clickTestStart;
  const remaining = Math.max(0, CLICK_TEST_DURATION_MS - clickElapsed);
  counter.textContent = clickCount.toString();
  instruction.textContent = `${(remaining / 1000).toFixed(1)}s`;

  if (remaining <= 0) {
    setState(STATES.CLICK_RESULT);
    return;
  }

  animationFrame = requestAnimationFrame(updateClickTest);
}

function requestFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }
}

function setState(nextState) {
  clearStateTimers();

  state = nextState;
  robot.dataset.state = state;
  delete robot.dataset.locked;
  animalResult.textContent = "";

  if (state !== STATES.CLICK_RESULT) {
    inputLockedUntil = 0;
  }

  switch (state) {
    case STATES.SLEEPING:
      elapsedMs = 0;
      counter.textContent = "--.--";
      setText("SHHH... ESTOU DORMINDO", "PARA ACORDAR");
      rotateExpressions(["sleep", "deep-sleep", "dream", "yawn", "peek"]);
      break;

    case STATES.WAKING:
      drawTarget();
      elapsedMs = 0;
      counter.textContent = "--.--";
      robot.dataset.expression = "wake";
      setText(`ALVO: ${targetSecond.toFixed(2)}`, "PARA COMEÇAR");
      break;

    case STATES.PLAYING:
      elapsedMs = 0;
      counter.textContent = "00.00";
      setText(`ALVO: ${targetSecond.toFixed(2)}`, "");

      startTime = performance.now();
      animationFrame = requestAnimationFrame(updateTimer);
      break;

    case STATES.COUNTDOWN:
      countdownValue = 3;
      robot.dataset.expression = "wake";
      counter.textContent = countdownValue.toString();
      setText("", "");
      transitionTimer = setInterval(() => {
        countdownValue -= 1;

        if (countdownValue <= 0) {
          setState(STATES.PLAYING);
          return;
        }

        counter.textContent = countdownValue.toString();
      }, COUNTDOWN_STEP_MS);
      break;

    case STATES.VICTORY:
      inputLockedUntil = performance.now() + TIMER_RESULT_LOCK_MS;
      robot.dataset.locked = "true";
      robot.dataset.expression = "happy";
      counter.textContent = formatTime(elapsedMs);
      setText("", "");
      transitionTimer = setTimeout(() => {
        if (state === STATES.VICTORY) delete robot.dataset.locked;
      }, TIMER_RESULT_LOCK_MS);
      break;

    case STATES.DEFEAT:
      inputLockedUntil = performance.now() + TIMER_RESULT_LOCK_MS;
      robot.dataset.locked = "true";
      robot.dataset.expression = "laugh";
      counter.textContent = formatTime(elapsedMs);
      setText("", "");
      transitionTimer = setTimeout(() => {
        if (state === STATES.DEFEAT) delete robot.dataset.locked;
      }, TIMER_RESULT_LOCK_MS);
      break;

    case STATES.CLICK_READY:
      robot.dataset.expression = "wake";
      counter.textContent = "5.0s";
      setText("TESTE DE VELOCIDADE", "PARA COMEÇAR");
      break;

    case STATES.CLICK_TEST:
      clickCount = 0;
      spaceReleasedForCps = false;
      clickTestStart = performance.now();
      robot.dataset.expression = "wake";
      setText("CLIQUE!", "");
      counter.textContent = clickCount.toString();
      animationFrame = requestAnimationFrame(updateClickTest);
      break;

    case STATES.CLICK_RESULT: {
      const cps = clickCount / (CLICK_TEST_DURATION_MS / 1000);
      const animal = getAnimalForCps(cps);
      inputLockedUntil = performance.now() + CLICK_RESULT_LOCK_MS;
      robot.dataset.expression = "happy";
      counter.textContent = `${cps.toFixed(1)} CPS`;
      animalResult.textContent = `${animal.icon} ${animal.name}`;
      setText("", "AGUARDE...");
      transitionTimer = setTimeout(() => {
        if (state === STATES.CLICK_RESULT) {
          setText("", "PARA REPETIR");
        }
      }, CLICK_RESULT_LOCK_MS);
      break;
    }
  }
}

function handleSpace() {
  requestFullscreen();
  resetInactivityTimer();

  switch (state) {
    case STATES.SLEEPING:
      setState(STATES.WAKING);
      break;

    case STATES.PLAYING: {
      elapsedMs = performance.now() - startTime;
      counter.textContent = formatTime(elapsedMs);

      if (getDisplayedTime(elapsedMs) === targetSecond) {
        setState(STATES.VICTORY);
      } else {
        setState(STATES.DEFEAT);
      }

      break;
    }

    case STATES.VICTORY:
    case STATES.DEFEAT:
      setState(STATES.WAKING);
      break;

    case STATES.CLICK_READY:
      setState(STATES.CLICK_TEST);
      break;

    case STATES.CLICK_RESULT:
      setState(STATES.CLICK_READY);
      break;

    case STATES.CLICK_TEST:
      break;

    case STATES.WAKING:
      setState(STATES.COUNTDOWN);
      break;
  }
}

function isActiveGameState() {
  return state === STATES.COUNTDOWN || state === STATES.PLAYING || state === STATES.CLICK_TEST;
}

function switchGameMode() {
  const isClickMode = state === STATES.CLICK_READY || state === STATES.CLICK_RESULT;
  setState(isClickMode ? STATES.WAKING : STATES.CLICK_READY);
}

document.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();

    if (performance.now() < inputLockedUntil || event.repeat) return;

    if (state === STATES.CLICK_TEST) {
      if (spaceReleasedForCps) {
        clickCount += 1;
        spaceReleasedForCps = false;
        counter.textContent = clickCount.toString();
      }
      return;
    }

    handleSpace();
    return;
  }

  if (event.code === "KeyM") {
    event.preventDefault();

    if (performance.now() < inputLockedUntil || event.repeat || modePressTimer || isActiveGameState()) return;

    modePressTimer = setTimeout(() => {
      switchGameMode();
      modePressTimer = null;
    }, LONG_PRESS_MS);
  }
});

document.addEventListener("keyup", (event) => {
  if (event.code === "Space" && state === STATES.CLICK_TEST) {
    event.preventDefault();
    spaceReleasedForCps = true;
    return;
  }

  if (event.code !== "KeyM") return;

  event.preventDefault();
  clearTimeout(modePressTimer);
  modePressTimer = null;
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    setState(STATES.SLEEPING);
  }
});

setState(STATES.SLEEPING);
resetInactivityTimer();
