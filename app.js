// Connects your UI directly to your Node backend scan script
document.addEventListener("DOMContentLoaded", () => {
  fetch('http://localhost:3000/api/media')
    .then(response => {
      if (!response.ok) throw new Error("Network response error checking local media folder.");
      return response.json();
    })
    .then(automatedPayload => {
      // Pass the live folder payload array right into your existing layout engine
      window.PlexApp = new PlexMediaEngine(automatedPayload);
    })
    .catch(error => {
      console.error("Failed to load local media tree:", error);
      document.getElementById("mediaGrid").innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:40px; color:#ff4444;">
          <h3>⚠️ Unable to connect to local media scanner</h3>
          <p style="margin-top:10px; color:var(--text-secondary);">Make sure your Node.js backend server is running via terminal (node server.js)</p>
        </div>`;
    });
});

class PlexMediaEngine {
  constructor(dataTree) {
    this.tree = dataTree;
    this.currentPathNodes = []; // Array of tracking names for index mapping
    this.currentDirectory = this.tree;
    
    this.grid = document.getElementById("mediaGrid");
    this.breadcrumbs = document.getElementById("breadcrumbs");
    this.player = document.getElementById("mainVideoPlayer");
    this.source = document.getElementById("videoSource");
    this.search = document.getElementById("searchInput");
    
    this.initEventListeners();
    this.render();
  }

  initEventListeners() {
    this.search.addEventListener("input", (e) => this.filterSearch(e.target.value));
    
    document.getElementById("btnHome").addEventListener("click", () => this.resetToRoot());
    document.getElementById("btnMovies").addEventListener("click", () => this.jumpToSection("Movies"));
    document.getElementById("btnShows").addEventListener("click", () => this.jumpToSection("TV Shows"));
  }

  // Calculate folder size natively
  countItems(node) {
    if (node.type !== "folder") return 0;
    let count = 0;
    node.children.forEach(child => {
      if (child.type === "video") count++;
      if (child.type === "folder") count += this.countItems(child);
    });
    return count;
  }

  // Deep structural traversal pointer assignment
  getCurrentDirectory() {
    let current = this.tree;
    for (const folderName of this.currentPathNodes) {
      const found = current.find(item => item.type === "folder" && item.name === folderName);
      if (found && found.children) {
        current = found.children;
      }
    }
    return current;
  }

  navigateToFolder(folderName) {
    this.currentPathNodes.push(folderName);
    this.search.value = "";
    this.render();
  }

  navigateBackToCrumb(index) {
    this.currentPathNodes = this.currentPathNodes.slice(0, index + 1);
    this.search.value = "";
    this.render();
  }

  resetToRoot() {
    this.currentPathNodes = [];
    this.search.value = "";
    this.render();
  }

  jumpToSection(sectionName) {
    this.currentPathNodes = [sectionName];
    this.search.value = "";
    this.render();
  }

  // Build breadcrumbs dynamically
  renderBreadcrumbs() {
    this.breadcrumbs.innerHTML = "";
    
    const homeNode = document.createElement("span");
    homeNode.className = "crumb-node";
    homeNode.textContent = "Server Main";
    homeNode.addEventListener("click", () => this.resetToRoot());
    this.breadcrumbs.appendChild(homeNode);

    this.currentPathNodes.forEach((nodeName, index) => {
      const separator = document.createTextNode(" › ");
      this.breadcrumbs.appendChild(separator);

      const crumb = document.createElement("span");
      crumb.className = "crumb-node";
      crumb.textContent = nodeName;
      crumb.addEventListener("click", () => this.navigateBackToCrumb(index));
      this.breadcrumbs.appendChild(crumb);
    });
  }

  // Dynamic creation and rendering of Plex cards
  render(targetData = null) {
    this.renderBreadcrumbs();
    this.grid.innerHTML = "";
    
    const itemsToRender = targetData || this.getCurrentDirectory();

    if (itemsToRender.length === 0) {
      this.grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:var(--text-secondary); margin-top:40px;">No media assets found here.</div>`;
      return;
    }

    itemsToRender.forEach(item => {
      const card = document.createElement("div");
      card.className = "plex-card";

      // Choose graphics based on metadata availability
      let frameContent = "";
      if (item.type === "folder") {
        const totalTracks = this.countItems(item);
        frameContent = `
          <div class="poster-fallback">📁</div>
          <span class="card-badge">${totalTracks} Items</span>
        `;
      } else {
        frameContent = `
          <div class="poster-fallback">🎬</div>
          <span class="card-badge" style="background:#ff9900; color:#fff">${item.year}</span>
        `;
      }

      card.innerHTML = `
        <div class="poster-frame">${frameContent}</div>
        <div class="card-title">${item.name.replace(".mp4", "").replace(".mov", "")}</div>
        <div class="card-subtext">${item.type === "folder" ? "Media Collection" : item.genre}</div>
      `;

      // Assign card click event hooks based on data type structural targets
      card.addEventListener("click", () => {
        if (item.type === "folder") {
          this.navigateToFolder(item.name);
        } else if (item.type === "video") {
          this.bootCinematicPlayer(item);
        }
      });

      this.grid.appendChild(card);
    });
  }

  // Interactive Plex Global Filter Search Engine Array Parser
  filterSearch(keyword) {
    if (!keyword.trim()) {
      this.render();
      return;
    }

    const flatResults = [];
    const searchRecursive = (nodes) => {
      nodes.forEach(node => {
        if (node.type === "video" && node.name.toLowerCase().includes(keyword.toLowerCase())) {
          flatResults.push(node);
        }
        if (node.children) searchRecursive(node.children);
      });
    };

    searchRecursive(this.tree);
    this.render(flatResults);
  }

  // Stream Injection Engine
  bootCinematicPlayer(mediaItem) {
    document.getElementById("metaTitle").textContent = mediaItem.name.replace(".mp4", "");
    document.getElementById("metaPlot").textContent = mediaItem.plot;
    document.getElementById("metaType").textContent = `${mediaItem.genre.toUpperCase()} • ${mediaItem.year}`;

    this.source.setAttribute("src", mediaItem.url);
    this.player.load();
    this.player.play().catch(err => console.log("Stream delivery blocked or source missing: ", err));
  }
}

// Instantiate engine when DOM is active
document.addEventListener("DOMContentLoaded", () => {
  window.PlexApp = new PlexMediaEngine(rawMediaPayload);
});
