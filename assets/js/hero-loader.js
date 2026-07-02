document.addEventListener("DOMContentLoaded", () => {

  // Load JSON data
  fetch("assets/image-data.json")
    .then(response => response.json())
    .then(data => {

      // Only use images marked Include = true
      const included = data.filter(img => img.Include === true);

      // Shuffle helper
      const shuffle = arr => arr.sort(() => Math.random() - 0.5);

      // Pick 4 desktop images
      const desktopImages = shuffle([...included]).slice(0, 4);

      // Mobile rotation uses the same shuffled list
      let mobileIndex = 0;

      // ----- DESKTOP HERO -----
      const desktopHero = document.querySelector(".hero-desktop");
      if (desktopHero && desktopImages.length > 0) {
        desktopImages.forEach(img => {
          const div = document.createElement("div");
          div.className = "hero-img";
          div.style.backgroundImage = `url('assets/images/${img.Filename}')`;
          div.setAttribute("aria-label", img["Alt Text"]);
          desktopHero.appendChild(div);
        });
      }

      // ----- MOBILE HERO -----
      const mobileHero = document.querySelector(".hero-mobile");
      if (mobileHero && desktopImages.length > 0) {

        const updateMobileHero = () => {
          const img = desktopImages[mobileIndex];
          mobileHero.style.backgroundImage = `url('assets/images/${img.Filename}')`;
          mobileHero.setAttribute("aria-label", img["Alt Text"]);
          mobileIndex = (mobileIndex + 1) % desktopImages.length;
        };

        updateMobileHero(); // initial load
        setInterval(updateMobileHero, 4000); // fade every 4 seconds
      }
    })
    .catch(err => {
      console.error("Hero loader error:", err);
    });

});
