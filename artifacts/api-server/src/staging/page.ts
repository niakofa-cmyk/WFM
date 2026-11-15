export function stagingAccessPage(rejected = false, unlocked = false) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>WFM — Private staging</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#080b12;color:#e6e1d6;font:16px system-ui,sans-serif;padding:24px}
main{width:min(100%,420px);border:1px solid #343945;background:#141820;padding:32px;border-radius:12px}
p{line-height:1.6;color:#aaa295}h1{font-size:28px;margin:12px 0}label{display:block;margin:24px 0 8px}
input,button{font:inherit;width:100%;padding:14px;border-radius:6px}input{border:1px solid #687080;background:#080b12;color:#fff}
button{margin-top:16px;background:#e0a15a;border:0;color:#080b12;font-weight:700;cursor:pointer}
input:focus-visible,button:focus-visible{outline:3px solid #f3c98e;outline-offset:3px}.error{color:#ffb4a7}.tag{font-size:12px;letter-spacing:2px;color:#e0a15a}
</style></head><body><main><div class="tag">WAR FOR MARS · STAGING</div>
<h1>Private playtest access</h1><p>${unlocked ? "Staging access is unlocked in this browser." : "Enter the staging access code supplied by the test owner."} Clerk sign-in is still required for account progress.</p>
${rejected ? '<p class="error" role="alert">Access was not granted. Check the code or try again later.</p>' : ""}
${unlocked ? '<p><a href="/" style="color:#e0a15a">Return to WFM</a></p><form method="post" action="/__staging/logout"><button type="submit">Lock staging access</button></form>' : `<form method="post" action="/__staging/access"><label for="access-code">Staging access code</label>
<input id="access-code" name="accessCode" type="password" autocomplete="off" required maxlength="256">
<button type="submit">Continue to WFM</button></form>`}
<p>Do not use your Clerk password here. Gateway restarts require this code again.</p></main></body></html>`;
}
