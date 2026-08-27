// Centralized Rental Rates
const rentalRates = {
  oneBed: "$1,100*",
  twoBed: "$1,300*",
  threeBed: "$1,600*",
  disclaimer: "*Plus utilities (tenant pays gas & electric). <b>Prices subject to change</b> and may vary by amenities and unit size and DC Rent Control Regulations. All applications subject to approval and credit check."
};

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".rate-1bed").forEach(el => el.textContent = rentalRates.oneBed);
  document.querySelectorAll(".rate-2bed").forEach(el => el.textContent = rentalRates.twoBed);
  document.querySelectorAll(".rate-3bed").forEach(el => el.textContent = rentalRates.threeBed);
});