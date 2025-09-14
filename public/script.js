fetch("http://localhost:3000/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username, password }),
})
  .then((res) => res.json())
  .then((data) => {
    localStorage.setItem("token", data.token); // save JWT
    window.location.href = "dashboard.html"; // go to dashboard
  });
