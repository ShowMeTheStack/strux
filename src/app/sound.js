// Soft sounds for what a step did (off unless turned on in Settings): a tick for a comparison, two notes
// for a swap, a rising blip for malloc, a falling one for free, a chime at the end.
(function (SEE) {
  'use strict';
  const X = SEE.Strux;
  let ctx = null;
  const audio = () => {
    if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  function tone(freq, at, len, type, vol, slide) {
    const a = audio();
    if (!a) return;
    const t = a.currentTime + (at || 0);
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + len);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.08, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + len + 0.02);
  }
  X.Sound = {
    play(tag) {
      tag = tag || '';
      try {
        if (/^(compare|cmp|test|check|probe)/.test(tag)) tone(880, 0, 0.06, 'triangle', 0.05);
        else if (/^swap/.test(tag)) { tone(520, 0, 0.09, 'sine', 0.07); tone(660, 0.08, 0.09, 'sine', 0.07); }
        else if (/^(new|alloc|malloc|grow)/.test(tag)) tone(400, 0, 0.14, 'sine', 0.07, 800);
        else if (/^(free|delete|remove)/.test(tag)) tone(600, 0, 0.16, 'sine', 0.06, 260);
        else if (/^(move|shift|copy|place|follow|walk|advance|step|go-)/.test(tag)) tone(330, 0, 0.05, 'triangle', 0.035);
        else if (tag === 'after') { tone(660, 0, 0.18, 'sine', 0.06); tone(880, 0.1, 0.18, 'sine', 0.05); tone(1320, 0.2, 0.3, 'sine', 0.04); }
      } catch (e) { /* no audio here */ }
    },
  };
})(SEE);
