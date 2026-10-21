const STORAGE_KEY = "iku-emk-task-tracker-v1";

const form = document.querySelector("#task-form");
const taskInput = document.querySelector("#task-input");
const categoryInput = document.querySelector("#category-input");
const dateInput = document.querySelector("#date-input");
const assigneeInput = document.querySelector("#assignee-input");
const taskList = document.querySelector("#task-list");
const filterInput = document.querySelector("#filter-input");
const searchInput = document.querySelector("#search-input");
const emptyState = document.querySelector("#empty-state");
const authPanel = document.querySelector("#auth-panel");
const appContent = document.querySelector("#app-content");
const authForm = document.querySelector("#auth-form");
const authEmail = document.querySelector("#auth-email");
const authPassword = document.querySelector("#auth-password");
const authMessage = document.querySelector("#auth-message");
const appMessage = document.querySelector("#app-message");
const connectionStatus = document.querySelector("#connection-status");
const signoutButton = document.querySelector("#signout-button");

let tasks = [];
let signedInUser = null;
let refreshTimer = null;

const config = window.SUPABASE_CONFIG || {};
const configIsReady =
  Boolean(config.url) &&
  Boolean(config.publishableKey) &&
  !config.publishableKey.includes("BURAYA_");

if (!window.supabase || !configIsReady) {
  connectionStatus.dataset.state = "error";
  connectionStatus.innerHTML = "<span></span> Kurulum gerekli";
  authMessage.textContent = "Supabase bağlantı bilgileri eksik. supabase-config.js dosyasına proje URL’si ve yayınlanabilir anahtar eklenmeli.";
  authMessage.dataset.kind = "error";
} else {
  const client = window.supabase.createClient(config.url, config.publishableKey);

  function setAuthMessage(message, kind) {
    authMessage.textContent = message || "";
    authMessage.dataset.kind = kind || "";
  }

  function setAppMessage(message, kind) {
    appMessage.textContent = message || "";
    appMessage.dataset.kind = kind || "";
  }

  function setConnectionStatus(message, state) {
    connectionStatus.dataset.state = state;
    connectionStatus.innerHTML = "<span></span> " + message;
  }

  function showSignedInArea(isSignedIn) {
    authPanel.hidden = isSignedIn;
    appContent.hidden = !isSignedIn;
  }

  function stopRefreshTimer() {
    if (refreshTimer) {
      window.clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  function startRefreshTimer() {
    stopRefreshTimer();
    refreshTimer = window.setInterval(function () {
      if (signedInUser) loadTasks();
    }, 20000);
  }

  async function checkMembership(email) {
    const result = await client
      .from("club_members")
      .select("email")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (result.error) throw result.error;
    return Boolean(result.data);
  }

  async function handleSession(session) {
    const user = session && session.user ? session.user : null;
    signoutButton.hidden = !user;

    if (!user) {
      signedInUser = null;
      stopRefreshTimer();
      showSignedInArea(false);
      setConnectionStatus("Supabase hazır", "connected");
      setAuthMessage("Kulüp e-posta adresin ve şifrenle giriş yap.", "");
      return;
    }

    signedInUser = user;
    showSignedInArea(false);
    setConnectionStatus("Üye kontrol ediliyor", "connecting");
    setAuthMessage("Kulüp üyeliğin kontrol ediliyor…", "");

    try {
      const isMember = await checkMembership(user.email || "");
      if (!isMember) {
        signedInUser = null;
        setConnectionStatus("Üyelik izni yok", "error");
        setAuthMessage(
          "Bu e-posta adresi kulüp erişim listesinde bulunmuyor. Proje yöneticisinden eklemesini iste.",
          "error"
        );
        return;
      }

      showSignedInArea(true);
      setConnectionStatus("Ortak veritabanına bağlı", "connected");
      setAuthMessage("", "");
      setAppMessage("", "");
      await loadTasks();
      startRefreshTimer();
    } catch (error) {
      signedInUser = null;
      setConnectionStatus("Bağlantı hatası", "error");
      setAuthMessage(
        "Üyelik kontrolü yapılamadı. Supabase tablosu ve erişim kurallarının kurulduğunu kontrol et.",
        "error"
      );
      console.error(error);
    }
  }

  async function loadTasks() {
    if (!signedInUser) return;

    const result = await client
      .from("tasks")
      .select("id, title, category, due_date, assignee, completed, created_at")
      .order("created_at", { ascending: false });

    if (result.error) {
      setAppMessage("Görevler yüklenemedi. Veritabanı izinlerini kontrol et.", "error");
      console.error(result.error);
      return;
    }

    tasks = result.data.map(function (row) {
      return {
        id: row.id,
        title: row.title,
        category: row.category,
        dueDate: row.due_date || "",
        assignee: row.assignee || "",
        completed: Boolean(row.completed)
      };
    });

    renderTasks();
    setAppMessage("", "");
  }

  function formatDate(dateString) {
    if (!dateString) return "";

    const parts = dateString.split("-");
    return parts[2] + "." + parts[1] + "." + parts[0];
  }

  function getLocalDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function renderTasks() {
    const filter = filterInput.value;
    const searchTerm = searchInput.value.trim().toLocaleLowerCase("tr-TR");

    const visibleTasks = tasks
      .filter(function (task) {
        if (filter === "active" && task.completed) return false;
        if (filter === "completed" && !task.completed) return false;

        const searchableText =
          (task.title + " " + task.category + " " + task.assignee)
            .toLocaleLowerCase("tr-TR");

        return searchableText.includes(searchTerm);
      })
      .sort(function (a, b) {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });

    taskList.replaceChildren();

    visibleTasks.forEach(function (task) {
      const item = document.createElement("article");
      item.className = "task-item" + (task.completed ? " is-completed" : "");

      const checkbox = document.createElement("input");
      checkbox.className = "task-check";
      checkbox.type = "checkbox";
      checkbox.checked = task.completed;
      checkbox.setAttribute("aria-label", task.title + " görevini tamamlandı olarak işaretle");
      checkbox.addEventListener("change", async function () {
        const result = await client
          .from("tasks")
          .update({ completed: checkbox.checked })
          .eq("id", task.id);

        if (result.error) {
          setAppMessage("Görev durumu kaydedilemedi.", "error");
          console.error(result.error);
          return;
        }

        await loadTasks();
      });

      const content = document.createElement("div");

      const title = document.createElement("p");
      title.className = "task-title";
      title.textContent = task.title;

      const meta = document.createElement("div");
      meta.className = "task-meta";

      const category = document.createElement("span");
      category.className = "task-tag";
      category.textContent = task.category;
      meta.append(category);

      if (task.assignee) {
        const person = document.createElement("span");
        person.className = "task-person";
        person.textContent = "Sorumlu: " + task.assignee;
        meta.append(person);
      }

      if (task.dueDate) {
        const dueDate = document.createElement("span");
        dueDate.className = "task-date";
        dueDate.textContent = "Son tarih: " + formatDate(task.dueDate);

        if (!task.completed && task.dueDate < getLocalDateString()) {
          dueDate.classList.add("is-overdue");
          dueDate.textContent += " · Gecikti";
        }

        meta.append(dueDate);
      }

      content.append(title, meta);

      const deleteButton = document.createElement("button");
      deleteButton.className = "delete-button";
      deleteButton.type = "button";
      deleteButton.textContent = "Sil";
      deleteButton.setAttribute("aria-label", task.title + " görevini sil");
      deleteButton.addEventListener("click", async function () {
        const result = await client.from("tasks").delete().eq("id", task.id);

        if (result.error) {
          setAppMessage("Görev silinemedi.", "error");
          console.error(result.error);
          return;
        }

        await loadTasks();
      });

      item.append(checkbox, content, deleteButton);
      taskList.append(item);
    });

    document.querySelector("#total-count").textContent = tasks.length;
    document.querySelector("#active-count").textContent =
      tasks.filter(function (task) { return !task.completed; }).length;
    document.querySelector("#completed-count").textContent =
      tasks.filter(function (task) { return task.completed; }).length;

    emptyState.classList.toggle("visible", visibleTasks.length === 0);
  }

  authForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    setAuthMessage("Giriş yapılıyor…", "");

    const result = await client.auth.signInWithPassword({
      email: authEmail.value.trim(),
      password: authPassword.value
    });

    if (result.error) {
      setAuthMessage("Giriş yapılamadı. E-posta ve şifreni kontrol et.", "error");
      console.error(result.error);
      return;
    }

    await handleSession(result.data.session);
  });

  document.querySelector("#signup-button").addEventListener("click", async function () {
    if (!authForm.reportValidity()) return;

    setAuthMessage("Hesap oluşturuluyor…", "");
    const result = await client.auth.signUp({
      email: authEmail.value.trim(),
      password: authPassword.value,
      options: {
        emailRedirectTo: window.location.href
      }
    });

    if (result.error) {
      setAuthMessage("Hesap oluşturulamadı. Supabase Auth ayarlarını kontrol et.", "error");
      console.error(result.error);
      return;
    }

    if (result.data.session) {
      await handleSession(result.data.session);
    } else {
      setAuthMessage(
        "Doğrulama bağlantısı e-posta adresine gönderildi. E-postanı doğruladıktan sonra giriş yap.",
        "success"
      );
    }
  });

  signoutButton.addEventListener("click", async function () {
    stopRefreshTimer();
    const result = await client.auth.signOut();
    if (result.error) {
      setAuthMessage("Çıkış yapılamadı. Sayfayı yenileyip tekrar dene.", "error");
      return;
    }
    signedInUser = null;
    showSignedInArea(false);
    setConnectionStatus("Supabase hazır", "connected");
    setAuthMessage("Oturum kapatıldı.", "success");
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const title = taskInput.value.trim();
    if (!title || !signedInUser) {
      taskInput.focus();
      return;
    }

    const result = await client.from("tasks").insert({
      title: title,
      category: categoryInput.value,
      due_date: dateInput.value || null,
      assignee: assigneeInput.value.trim() || null,
      completed: false
    });

    if (result.error) {
      setAppMessage("Görev eklenemedi. Bağlantıyı kontrol edip tekrar dene.", "error");
      console.error(result.error);
      return;
    }

    form.reset();
    categoryInput.value = "Etkinlik";
    taskInput.focus();
    setAppMessage("Görev ortak listeye eklendi.", "success");
    await loadTasks();
  });

  filterInput.addEventListener("change", renderTasks);
  searchInput.addEventListener("input", renderTasks);

  document.querySelector("#clear-completed").addEventListener("click", async function () {
    const result = await client
      .from("tasks")
      .delete()
      .eq("completed", true);

    if (result.error) {
      setAppMessage("Tamamlanan görevler temizlenemedi.", "error");
      console.error(result.error);
      return;
    }

    setAppMessage("Tamamlanan görevler temizlendi.", "success");
    await loadTasks();
  });

  client.auth.onAuthStateChange(function (_event, session) {
    window.setTimeout(function () {
      handleSession(session);
    }, 0);
  });

  client.auth.getSession().then(function (result) {
    if (result.error) {
      setConnectionStatus("Bağlantı hatası", "error");
      setAuthMessage("Oturum bilgisi okunamadı.", "error");
      return;
    }
    handleSession(result.data.session);
  });

  renderTasks();
}




