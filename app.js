(function () {
  "use strict";

  const PROFILE_PATH = "content/profile.json";
  const PROJECTS_PATH = "content/projects.json";

  const DETAIL_FIELDS = [
    { keys: ["goal"], label: "goal" },
    { keys: ["implementation"], label: "implementation" },
    { keys: ["troubleshooting"], label: "troubleshooting" },
    { keys: ["lessons_learned", "lessonsLearned", "lessons learned"], label: "lessons learned" }
  ];

  const CONTACT_FIELDS = [
    { key: "github", label: "github", type: "url" },
    { key: "linkedin", label: "linkedin", type: "url" },
    { key: "email", label: "email", type: "email" }
  ];

  function getCleanText(value) {
    if (typeof value !== "string") {
      return "";
    }
    return value.trim();
  }

  function getValidExternalUrl(rawValue) {
    const trimmed = getCleanText(rawValue);
    if (!trimmed) {
      return null;
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return null;
      }
      if (!parsed.hostname || !parsed.hostname.includes(".")) {
        return null;
      }
      const lowerHost = parsed.hostname.toLowerCase();
      if (lowerHost === "example.com" || lowerHost.endsWith(".example.com")) {
        return null;
      }
      return parsed.href;
    } catch (_err) {
      return null;
    }
  }

  function getValidEmailHref(rawValue) {
    const trimmed = getCleanText(rawValue);
    if (!trimmed) {
      return null;
    }

    const address = trimmed.replace(/^mailto:/i, "").trim();
    if (!address || /\s/.test(address)) {
      return null;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(address)) {
      return null;
    }

    const domain = address.split("@")[1].toLowerCase();
    if (domain === "example.com" || domain.endsWith(".example.com")) {
      return null;
    }

    return "mailto:" + address;
  }

  function formatTechnologies(rawTech) {
    if (Array.isArray(rawTech)) {
      return rawTech
        .map((item) =>
          typeof item === "object" && item !== null
            ? getCleanText(item.technology || item.name || item.label)
            : getCleanText(item)
        )
        .filter(Boolean)
        .join(", ");
    }
    if (typeof rawTech === "string") {
      return rawTech
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .join(", ");
    }
    return "";
  }

  function extractProjectDetails(project) {
    if (!project || typeof project !== "object") {
      return [];
    }

    const detailsSource =
      project.details && typeof project.details === "object" ? project.details : project;

    const entries = [];
    for (const field of DETAIL_FIELDS) {
      let value = "";
      for (const key of field.keys) {
        if (typeof detailsSource[key] === "string" && detailsSource[key].trim()) {
          value = detailsSource[key].trim();
          break;
        }
        if (typeof project[key] === "string" && project[key].trim()) {
          value = project[key].trim();
          break;
        }
      }
      if (value) {
        entries.push({ label: field.label, value });
      }
    }

    return entries;
  }

  function renderProfile(profileData) {
    if (!profileData || typeof profileData !== "object") {
      return;
    }

    const nameEl = document.getElementById("profile-name");
    const roleEl = document.getElementById("profile-role");
    const introEl = document.getElementById("profile-intro");

    const name = getCleanText(profileData.name);
    const role = getCleanText(profileData.role || profileData.headline || profileData.title);
    const intro = getCleanText(profileData.intro || profileData.bio || profileData.description);

    if (nameEl && name) {
      nameEl.textContent = name;
      document.title = name;
    }

    if (roleEl) {
      if (role) {
        roleEl.textContent = role;
        roleEl.hidden = false;
      } else {
        roleEl.hidden = true;
      }
    }

    if (introEl) {
      if (intro) {
        introEl.textContent = intro;
        introEl.hidden = false;
      } else {
        introEl.hidden = true;
      }
    }

    renderContact(profileData);
  }

  function renderContact(profileData) {
    const contactSection = document.getElementById("contact-section");
    const contactNav = document.getElementById("contact-links");
    if (!contactSection || !contactNav) {
      return;
    }

    contactNav.replaceChildren();

    const contactSource =
      profileData.contact && typeof profileData.contact === "object"
        ? profileData.contact
        : profileData;

    let renderedCount = 0;

    for (const field of CONTACT_FIELDS) {
      const rawValue = contactSource[field.key] ?? profileData[field.key];
      const validHref =
        field.type === "email" ? getValidEmailHref(rawValue) : getValidExternalUrl(rawValue);

      if (!validHref) {
        continue;
      }

      const link = document.createElement("a");
      link.className = "text-link";
      link.href = validHref;
      link.textContent = field.label;

      if (field.type === "url") {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }

      contactNav.appendChild(link);
      renderedCount += 1;
    }

    contactSection.hidden = renderedCount === 0;
  }

  function createProjectRow(project) {
    if (!project || typeof project !== "object") {
      return null;
    }

    const title = getCleanText(project.title);
    if (!title) {
      return null;
    }

    const status = getCleanText(project.status);
    const description = getCleanText(project.description);
    const technologies = formatTechnologies(project.technologies);
    const repoUrl = getValidExternalUrl(project.repository || project.repo);
    const detailEntries = extractProjectDetails(project);

    const article = document.createElement("article");
    article.className = "project-row";

    const header = document.createElement("div");
    header.className = "project-header";

    const titleEl = document.createElement("h3");
    titleEl.className = "project-title";
    titleEl.textContent = title;
    header.appendChild(titleEl);

    if (status) {
      const statusEl = document.createElement("span");
      statusEl.className = "project-status";
      statusEl.textContent = status;
      header.appendChild(statusEl);
    }

    article.appendChild(header);

    if (description) {
      const descEl = document.createElement("p");
      descEl.className = "project-description";
      descEl.textContent = description;
      article.appendChild(descEl);
    }

    if (technologies) {
      const techEl = document.createElement("p");
      techEl.className = "project-technologies";
      techEl.textContent = technologies;
      article.appendChild(techEl);
    }

    if (repoUrl || detailEntries.length > 0) {
      const actions = document.createElement("div");
      actions.className = "project-actions";

      if (repoUrl) {
        const repoLink = document.createElement("a");
        repoLink.className = "text-link project-repo-link";
        repoLink.href = repoUrl;
        repoLink.target = "_blank";
        repoLink.rel = "noopener noreferrer";
        repoLink.textContent = "repository";
        actions.appendChild(repoLink);
      }

      if (detailEntries.length > 0) {
        const detailsEl = document.createElement("details");
        detailsEl.className = "project-details";

        const summaryEl = document.createElement("summary");
        summaryEl.className = "project-details-summary";
        summaryEl.textContent = "details";
        detailsEl.appendChild(summaryEl);

        const dl = document.createElement("dl");
        dl.className = "project-details-list";

        for (const item of detailEntries) {
          const itemWrap = document.createElement("div");
          itemWrap.className = "project-detail-item";

          const dt = document.createElement("dt");
          dt.textContent = item.label;

          const dd = document.createElement("dd");
          dd.textContent = item.value;

          itemWrap.appendChild(dt);
          itemWrap.appendChild(dd);
          dl.appendChild(itemWrap);
        }

        detailsEl.appendChild(dl);
        actions.appendChild(detailsEl);
      }

      article.appendChild(actions);
    }

    return article;
  }

  function renderProjects(projectsPayload) {
    const listEl = document.getElementById("projects-list");
    if (!listEl) {
      return;
    }

    listEl.replaceChildren();

    const rawProjects = Array.isArray(projectsPayload?.projects)
      ? projectsPayload.projects
      : Array.isArray(projectsPayload)
        ? projectsPayload
        : [];

    const rows = [];
    for (const item of rawProjects) {
      const row = createProjectRow(item);
      if (row) {
        rows.push(row);
      }
    }

    if (rows.length === 0) {
      const emptyEl = document.createElement("p");
      emptyEl.className = "empty-notice";
      emptyEl.textContent = "no projects listed yet.";
      listEl.appendChild(emptyEl);
      return;
    }

    for (const row of rows) {
      listEl.appendChild(row);
    }
  }

  function renderProjectsError() {
    const listEl = document.getElementById("projects-list");
    if (!listEl) {
      return;
    }

    listEl.replaceChildren();
    const errorEl = document.createElement("p");
    errorEl.className = "empty-notice";
    errorEl.textContent = "projects could not be loaded right now.";
    listEl.appendChild(errorEl);
  }

  async function fetchJson(path) {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error("Failed to load " + path + " (" + response.status + ")");
    }
    return response.json();
  }

  async function init() {
    const [profileResult, projectsResult] = await Promise.allSettled([
      fetchJson(PROFILE_PATH),
      fetchJson(PROJECTS_PATH)
    ]);

    if (profileResult.status === "fulfilled") {
      renderProfile(profileResult.value);
    }

    if (projectsResult.status === "fulfilled") {
      renderProjects(projectsResult.value);
    } else {
      renderProjectsError();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
