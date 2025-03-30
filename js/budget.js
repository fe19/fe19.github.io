const inputElements = document.getElementsByClassName('input-configuration'); // [input-person1-name, input-person2-name]
const outputElementsModifiable = document.getElementsByClassName('output-name-modifiable'); // [output-person1-name, output-person2-name]

const currency = '€';

function listenerInputPerson(inputPerson) {
    inputPerson.addEventListener('input', () => {
        const id = inputPerson.id;
        const idSuffix = getInputSuffix(id);
        const value = inputPerson.value;
        store(idSuffix, value);
        updateField(idSuffix, value);
    });
}

function listenerTable() {
    const inputElements = document.querySelectorAll('input.input-expense');
    for (const inputElement of inputElements) {
        const id = inputElement.id;
        inputElement.addEventListener('input', (input) => {
            const amount = inputElement.value;
            store(id, amount);
            computeTotal();
            computePersons();
        });
    }
    const inputDescriptions = document.querySelectorAll('input.input-description');
    for (const inputDescription of inputDescriptions) {
        const id = inputDescription.id;
        inputDescription.addEventListener('input', (input) => {
            const amount = inputDescription.value;
            store(id, amount);
        });
    }
}

function updateField(idSuffix, value) {
    const id = 'output-' + idSuffix;
    console.log('Debug: ', id);
    const field = document.getElementById(id);
    field.textContent = `${value} spent`;
    console.log(`Update ${field.id} = ${value}`);
}

function updateInput(idSuffix, value) {
    const id = 'input-' + idSuffix;
    const element = document.getElementById(id);
    element.value = value;
    console.log(`Update element ${id} = ${value}`);
}

function store(key, value) {
    localStorage.setItem(key, value);
    console.log(`Save to storage (${key}, ${value})`);
}

function saveToFile(data, filename) {
    const stringData = data;
    const file = new Blob([stringData], {type: 'text/plain'});
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(file);
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
    console.log(`Save to file ${filename} with content ${data}`);
}

function loadInitial() {
    console.log('Load initial values');
    for (const inputElement of inputElements) {
        const key = getInputSuffix(inputElement.id);
        const value = localStorage.getItem(key);
        console.log(`   Load from storage (${key}, ${value})`);
        updateInput(key, value);
        updateField(key, value);
    }
}

function loadTable() {
    const inputExpenses = document.querySelectorAll('input.input-expense');
    for (const input of inputExpenses) {
        const key = input.id;
        const value = localStorage.getItem(key);
        input.value = value;
        console.log(`   Load from storage (${key}, ${value})`);
    }
    const inputDescriptions = document.querySelectorAll('input.input-description');
    for (const input of inputDescriptions) {
        const key = input.id;
        const value = localStorage.getItem(key);
        input.value = value;
        console.log(`   Load from storage (${key}, ${value})`);
    }
}

function computeTotal() {
    const outputTotal = document.getElementById('output-total');
    const inputExpenses = document.querySelectorAll('input.input-expense');
    let total = 0.0;
    inputExpenses.forEach(expense => {
        const amount = expense.value === '' ? 0 : parseInt(expense.value);
        total += parseInt(amount);
    });
    outputTotal.textContent = `${currency}${total.toFixed(2)}`;
    console.log('Compute total = ', total);
}

function computePersons() {
    const outputPerson1 = document.getElementById('output-person1');
    const outputPerson2 = document.getElementById('output-person2');
    const inputExpenses = document.querySelectorAll('input.input-expense');
    let total1 = 0.0;
    let total2 = 0.0;
    inputExpenses.forEach(expense => {
        const amount = expense.value === '' ? 0 : parseInt(expense.value);
        const percentage1 = 0.7;
        const percentage2 = 0.3;
        total1 += parseInt(amount) * percentage1;
        total2 += parseInt(amount) * percentage2;
    });
    outputPerson1.textContent = `${currency}${total1.toFixed(2)}`;
    outputPerson2.textContent = `${currency}${total2.toFixed(2)}`;
}

function activateNightMode() {
    console.log('Register night mode');
    var now = new Date();
    var hours = now.getHours();
    const inputElements = document.querySelectorAll('.input-group, .input-group-text, .form-control, .table, td');
    if (hours >= 21 || hours <= 5) {
        for (inputElement of inputElements) {
            inputElement.classList.add('color-night');
        }
        document.body.style.background = "#355C7D";
        document.body.style.color = "white";
        console.log('Switch to night mode');
    }
}

function getInputSuffix(id) {
    return id.substring(6); // input-person1-name -> person1-name
}

function getOutputSuffix(id) {
    return id.substring(7); // output-person1-name -> person1-name
}

loadInitial();
loadTable();

activateNightMode();

for (const inputElement of inputElements) {
    listenerInputPerson(inputElement);
}

listenerTable();

computeTotal();
computePersons();

console.log('Successful');
