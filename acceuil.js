const title = document.getElementById("title");
const startBtn = document.getElementById("startBtn");

// Cliquer sur le titre : il monte et disparaît, bouton apparaît
title.addEventListener("click", () => {
  title.style.transform = "translate(-50%,-60%) scale(0.98)";
  title.style.top = "20%";
  title.style.opacity = "0"; // disparition
  // réduit aussi la forme verte légèrement
  const forme = document.querySelector(".formes-verte");
  if (forme) {
    forme.style.transform = "translateX(-50%) scale(0.98)";
    forme.style.opacity = "0.06";
  }

  setTimeout(() => {
    startBtn.classList.remove("hidden");
  }, 500);
});

// Cliquer sur le bouton commence : redirection vers maps.html
startBtn.addEventListener("click", () => {
  window.location.href = "maps.html";
});

// Menu latéral
const burger = document.getElementById("burger");
const sideMenu = document.getElementById("sideMenu");
burger.addEventListener("click", () => {
  if (sideMenu.style.left === "0px") {
    sideMenu.style.left = "-260px";
  } else {
    sideMenu.style.left = "0px";
  }
});

document.addEventListener("click", (e) => {
  if (sideMenu.style.left === "0px") {
    if (sideMenu.contains(e.target) || burger.contains(e.target)) return;
    sideMenu.style.left = "-260px";
  }
});
