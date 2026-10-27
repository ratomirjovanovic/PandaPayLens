// HTML for the GitHub social preview (1280x640). Synthetic values only.
export function socialCardHtml({ logo, providers }) {
  return `<!doctype html>
<html>
<head>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1280px; height: 640px; overflow: hidden;
    font-family: Inter, system-ui, sans-serif; color: #eef1f5;
    background:
      radial-gradient(700px 420px at 92% -8%, rgba(63, 207, 142, 0.28), transparent 70%),
      radial-gradient(560px 380px at -6% 112%, rgba(56, 189, 248, 0.16), transparent 70%),
      #0a0d12;
    position: relative;
  }
  .grid {
    position: absolute; inset: 0;
    background-image: radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px);
    background-size: 28px 28px;
    mask-image: linear-gradient(90deg, rgba(0,0,0,0.9), rgba(0,0,0,0.25));
  }
  .wrap { position: relative; display: flex; height: 100%; padding: 64px 64px 60px 72px; gap: 48px; }
  .left { flex: 1; display: flex; flex-direction: column; }
  .brand { display: flex; align-items: center; gap: 18px; }
  .tile {
    width: 76px; height: 76px; border-radius: 20px; background: #fff;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 0 0 1px rgba(255,255,255,0.08), 0 12px 32px rgba(0,0,0,0.45);
  }
  .tile svg { width: 64px; height: 64px; }
  .word { font-size: 40px; font-weight: 800; letter-spacing: -0.02em; }
  .word span { color: #3fcf8e; }
  h1 {
    margin-top: 44px; font-size: 58px; line-height: 1.06; font-weight: 800; letter-spacing: -0.035em;
  }
  h1 em { font-style: normal; color: #3fcf8e; }
  .sub { margin-top: 22px; font-size: 22px; line-height: 1.5; color: #a9b1bf; max-width: 560px; }
  .chips { margin-top: auto; display: flex; gap: 10px; flex-wrap: wrap; }
  .chip {
    font-size: 16px; font-weight: 600; color: #d6dbe3; padding: 9px 14px; border-radius: 999px;
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  }
  .chip b { color: #3fcf8e; font-weight: 700; }
  .win {
    width: 470px; align-self: center; border-radius: 18px; overflow: hidden;
    background: linear-gradient(180deg, #141922, #10141b);
    border: 1px solid rgba(255,255,255,0.1);
    box-shadow: 0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(63,207,142,0.06);
  }
  .bar { display: flex; align-items: center; gap: 8px; padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.07); }
  .dot { width: 11px; height: 11px; border-radius: 50%; background: #2b313c; }
  .bar .t { margin-left: 10px; font-size: 13px; color: #7f8897; font-family: "JetBrains Mono", monospace; }
  .body { padding: 20px 22px 22px; }
  .label { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #7f8897; font-weight: 600; }
  .err { margin-top: 10px; padding: 16px 18px; border-radius: 12px; background: rgba(248,113,113,0.07); border: 1px solid rgba(248,113,113,0.25); }
  .code { font-family: "JetBrains Mono", monospace; font-size: 21px; font-weight: 600; color: #fca5a5; }
  .tags { margin-top: 10px; display: flex; gap: 8px; }
  .tag { font-size: 13px; font-weight: 600; padding: 4px 9px; border-radius: 6px; }
  .tag.cat { background: rgba(248,113,113,0.14); color: #fecaca; }
  .tag.retry { background: rgba(250,204,21,0.12); color: #fde68a; }
  .tag.conf { background: rgba(63,207,142,0.12); color: #a7f3d0; }
  .next { margin-top: 10px; font-size: 15px; color: #c5ccd7; line-height: 1.45; }
  .tl { margin-top: 18px; position: relative; padding-left: 22px; }
  .tl::before { content: ""; position: absolute; left: 5px; top: 8px; bottom: 8px; width: 2px; background: #262c36; }
  .ev { position: relative; display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-family: "JetBrains Mono", monospace; font-size: 15px; color: #dfe4ea; }
  .ev::before { content: ""; position: absolute; left: -22px; width: 12px; height: 12px; border-radius: 50%; background: var(--c); box-shadow: 0 0 0 4px #121720; }
  .ev .time { color: #6f7887; font-size: 13px; }
  .find { margin-top: 12px; display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 10px; background: rgba(250,204,21,0.07); border: 1px solid rgba(250,204,21,0.22); font-size: 14.5px; color: #fde68a; line-height: 1.4; }
  .find b { color: #fef3c7; }
</style>
</head>
<body>
  <div class="grid"></div>
  <div class="wrap">
    <div class="left">
      <div class="brand"><div class="tile">${logo}</div><div class="word">Panda<span>PayLens</span></div></div>
      <h1>Know exactly why<br>a payment <em>failed</em>.</h1>
      <p class="sub">Decode provider errors, rebuild the event timeline and catch duplicate, late and conflicting webhooks. Locally, in your browser.</p>
      <div class="chips">
        <div class="chip"><b>${providers}</b> payment providers</div>
        <div class="chip">No data leaves your browser</div>
        <div class="chip">Source available</div>
      </div>
    </div>
    <div class="win">
      <div class="bar"><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="t">analysis.json</div></div>
      <div class="body">
        <div class="label">Decoded error</div>
        <div class="err">
          <div class="code">insufficient_funds</div>
          <div class="tags"><span class="tag cat">card_declined</span><span class="tag retry">customer action</span><span class="tag conf">strong</span></div>
          <div class="next">Ask the customer for another payment method.</div>
        </div>
        <div class="label" style="margin-top:18px">Timeline</div>
        <div class="tl">
          <div class="ev" style="--c:#3fcf8e"><span>payment_intent.created</span><span class="time">12:00:01</span></div>
          <div class="ev" style="--c:#f87171"><span>charge.failed</span><span class="time">12:00:03</span></div>
          <div class="ev" style="--c:#f87171"><span>payment_intent.payment_failed</span><span class="time">12:00:03</span></div>
        </div>
        <div class="find"><span>&#9888;</span><span><b>Delivered twice.</b> Same event id received 2 times; handle webhooks idempotently.</span></div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
