// Centralized Rental Rates
const rentalRates = {
  oneBed: "$1,025*",
  twoBed: "$1,300*",
  threeBed: "$1,600*",
  disclaimer: "*Plus utilities (tenant pays gas & electric). Prices subject to change and may vary by unit size. All applications subject to approval and credit check."
};

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".rate-1bed").forEach(el => el.textContent = rentalRates.oneBed);
  document.querySelectorAll(".rate-2bed").forEach(el => el.textContent = rentalRates.twoBed);
  document.querySelectorAll(".rate-3bed").forEach(el => el.textContent = rentalRates.threeBed);
});