const PLANS_KEY = "emotion_maps_plans";
const SITE_OWNER = "siteadmin";

const container = document.getElementById("planContainer");

const burgerPlans = document.getElementById("burgerPlans");
const sideMenuPlans = document.getElementById("sideMenuPlans");

burgerPlans.addEventListener("click", (e) => {
  e.stopPropagation();
  sideMenuPlans.classList.toggle("open");
});
document.addEventListener("click", (e) => {
  if (!sideMenuPlans.classList.contains("open")) return;
  if (sideMenuPlans.contains(e.target) || burgerPlans.contains(e.target)) return;
  sideMenuPlans.classList.remove("open");
});

function renderPlans(){
  container.innerHTML = "";
  const plans = JSON.parse(localStorage.getItem(PLANS_KEY) || "[]");

  if (plans.length === 0) {
    container.innerHTML = "<p style='text-align:center;margin-top:40px;opacity:0.8'>Aucun plan enregistré pour l'instant.</p>";
    return;
  }

  plans.forEach((p, idx) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${p.img}" alt="${escapeHtml(p.name)}">
      <div class="meta">
        <div>
          <strong>${escapeHtml(p.name)}</strong><br>
          <small>par ${escapeHtml(p.creator || "anonyme")}</small>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
          <button class="openBtn" data-idx="${idx}">Ouvrir</button>
          <button class="deleteBtn" data-idx="${idx}">Supprimer</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  document.querySelectorAll(".openBtn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = Number(e.target.getAttribute("data-idx"));
      window.location.href = `maps.html?plan=${idx}`;
    });
  });

  document.querySelectorAll(".deleteBtn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = Number(e.target.getAttribute("data-idx"));
      const plans = JSON.parse(localStorage.getItem(PLANS_KEY) || "[]");
      const planned = plans[idx];
      const who = prompt("Pour supprimer, tape ton nom (créateur du plan) :");
      if (!who) return;

      if (who === planned.creator || who === SITE_OWNER) {
        plans.splice(idx,1);
        localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
        renderPlans();
      } else {
        alert("Tu n'es pas autorisé·e à supprimer ce plan.");
      }
    });
  });
}

function escapeHtml(s){ return String(s).replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
renderPlans();
