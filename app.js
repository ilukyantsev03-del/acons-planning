const works = [
  "Кладка",
  "Вертикальное армирование",
  "Штукатурка",
  "Гидроизоляция балконов",
  "Передача фронта"
];

const fronts = [];

const blocks = {
  "Блок 1": [1, 2, 3, 4, 5, 6],
  "Блок 2": [4, 5, 6, 7],
  "Блок 3": [4, 5, 6, 7]
};

const sides = ["А", "Г"];

for (const [block, floors] of Object.entries(blocks)) {
  for (const floor of floors) {
    for (const side of sides) {
      for (const work of works) {

        fronts.push({
          id: crypto.randomUUID(),
          block,
          floor,
          side,
          work,
          status: "Не начато",
          fact: "",
          people: "",
          constraint: ""
        });

      }
    }
  }
}

let selectedFront = null;

const matrixBody = document.getElementById("matrixBody");
const blockFilter = document.getElementById("blockFilter");
const sideFilter = document.getElementById("sideFilter");

const editor = document.getElementById("editor");
const editorTitle = document.getElementById("editorTitle");
const editorMeta = document.getElementById("editorMeta");

const statusInput = document.getElementById("status");
const factInput = document.getElementById("fact");
const peopleInput = document.getElementById("people");
const constraintInput = document.getElementById("constraint");

function statusClass(status) {
  switch (status) {
    case "Фронт готов":
      return "status-ready";

    case "В работе":
      return "status-work";

    case "Завершено":
      return "status-done";

    case "Приостановлено":
      return "status-pause";

    case "Ограничение":
      return "status-risk";

    default:
      return "status-not";
  }
}

function renderMatrix() {

  matrixBody.innerHTML = "";

  const blockValue = blockFilter.value;
  const sideValue = sideFilter.value;

  for (const [block, floors] of Object.entries(blocks)) {

    if (blockValue !== "all" && block !== blockValue) {
      continue;
    }

    for (const floor of floors) {

      for (const side of sides) {

        if (sideValue !== "all" && side !== sideValue) {
          continue;
        }

        const tr = document.createElement("tr");

        const titleTd = document.createElement("td");

        titleTd.innerHTML = `
          <strong>${block}</strong><br>
          ${floor} этаж<br>
          Ось ${side}
        `;

        tr.appendChild(titleTd);

        for (const work of works) {

          const front = fronts.find(
            item =>
              item.block === block &&
              item.floor === floor &&
              item.side === side &&
              item.work === work
          );

          const td = document.createElement("td");

          const button = document.createElement("button");

          button.className =
            "front-btn " + statusClass(front.status);

          button.innerHTML = `
            <div class="front-status">
              ${front.status}
            </div>

            <div class="front-fact">
              ${front.fact || "Факт не указан"}
            </div>
          `;

          button.addEventListener("click", () => {
            openEditor(front);
          });

          td.appendChild(button);

          tr.appendChild(td);
        }

        matrixBody.appendChild(tr);
      }
    }
  }

  updateStats();
}

function openEditor(front) {

  selectedFront = front;

  editorTitle.textContent = front.work;

  editorMeta.textContent =
    `${front.block} · ${front.floor} этаж · Ось ${front.side}`;

  statusInput.value = front.status;
  factInput.value = front.fact;
  peopleInput.value = front.people;
  constraintInput.value = front.constraint;

  editor.classList.remove("hidden");

  editor.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function saveFront() {

  if (!selectedFront) return;

  selectedFront.status = statusInput.value;
  selectedFront.fact = factInput.value;
  selectedFront.people = peopleInput.value;
  selectedFront.constraint = constraintInput.value;

  renderMatrix();

  editorMeta.textContent += " · сохранено";
}

function updateStats() {

  document.getElementById("doneCount").textContent =
    fronts.filter(x => x.status === "Завершено").length;

  document.getElementById("workCount").textContent =
    fronts.filter(x => x.status === "В работе").length;

  document.getElementById("riskCount").textContent =
    fronts.filter(
      x =>
        x.status === "Ограничение" ||
        x.status === "Приостановлено"
    ).length;

  document.getElementById("notCount").textContent =
    fronts.filter(x => x.status === "Не начато").length;
}

document
  .getElementById("saveBtn")
  .addEventListener("click", saveFront);

document
  .getElementById("closeEditor")
  .addEventListener("click", () => {
    editor.classList.add("hidden");
  });

blockFilter.addEventListener("change", renderMatrix);
sideFilter.addEventListener("change", renderMatrix);

renderMatrix();