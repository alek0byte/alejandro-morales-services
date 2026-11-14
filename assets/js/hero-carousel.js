/* Carrusel vertical de la palabra destacada del hero.
   Mantiene «manos.» y el resto del eslogan estáticos: el slot reserva el
   ancho de la variante más larga y aquí solo se alterna la palabra visible. */
(function () {
  "use strict";

  var slot = document.querySelector(".hero h1 .gem-slot");
  if (!slot) return;

  var words = Array.prototype.slice.call(slot.querySelectorAll(".gem"));
  var tail = slot.closest(".gem-tail");
  var manos = tail && tail.querySelector(".gem-manos");
  if (words.length < 2) return;

  var reduceQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var index = 0;
  var timer = null;
  var leavingTimer = null;
  var widths = [];
  var slotWidth = 0;

  words.forEach(function (word, i) {
    if (word.classList.contains("is-active")) index = i;
  });

  function measure() {
    slotWidth = slot.getBoundingClientRect().width;
    widths = words.map(function (word) {
      return word.getBoundingClientRect().width;
    });
  }

  function sameLine() {
    if (!manos) return false;
    var a = slot.getBoundingClientRect();
    var b = manos.getBoundingClientRect();
    return Math.abs(a.top - b.top) < 4;
  }

  /* Cierra el hueco que la palabra activa deja dentro del slot fijo.
     Solo se aplica si «manos.» comparte línea; si no, se deja intacto. */
  function placeManos() {
    if (!manos) return;
    var gap = Math.max(0, slotWidth - (widths[index] || 0));
    manos.style.transform = sameLine() && gap > 0.5
      ? "translateX(" + (-gap).toFixed(2) + "px)"
      : "";
  }

  function setAria() {
    words.forEach(function (word, i) {
      if (i === index) word.removeAttribute("aria-hidden");
      else word.setAttribute("aria-hidden", "true");
    });
  }

  function show(i, initial) {
    var previous = index;
    index = i;
    words.forEach(function (word, k) {
      var active = k === index;
      word.classList.toggle("is-active", active);
      if (active) word.classList.remove("is-leaving");
    });
    if (!initial && previous !== index) {
      var out = words[previous];
      out.classList.add("is-leaving");
      window.clearTimeout(leavingTimer);
      leavingTimer = window.setTimeout(function () {
        out.classList.remove("is-leaving");
      }, 650);
    }
    setAria();
    placeManos();
  }

  function advance() {
    show((index + 1) % words.length, false);
  }

  function schedule() {
    window.clearTimeout(timer);
    if ((reduceQuery && reduceQuery.matches) || document.hidden) return;
    timer = window.setTimeout(function () {
      advance();
      schedule();
    }, 3600);
  }

  function init() {
    measure();
    // Evita que el ajuste inicial de «manos.» se vea como una animación.
    if (manos) manos.style.transition = "none";
    show(index, true);
    window.requestAnimationFrame(function () {
      if (manos) manos.style.transition = "";
    });
    schedule();
  }

  window.addEventListener("resize", function () {
    measure();
    placeManos();
  });

  document.addEventListener("visibilitychange", schedule);

  if (reduceQuery) {
    var onReduceChange = function () {
      if (reduceQuery.matches) {
        window.clearTimeout(timer);
        show(0, true);
      } else {
        schedule();
      }
    };
    if (reduceQuery.addEventListener) reduceQuery.addEventListener("change", onReduceChange);
    else if (reduceQuery.addListener) reduceQuery.addListener(onReduceChange);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      window.requestAnimationFrame(init);
    });
  } else {
    init();
  }
})();
