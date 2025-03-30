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
    const inputElements = document.querySelectorAll('input.expense-input');
    for(const inputElement of inputElements) {
        const id = inputElement.id;
        inputElement.addEventListener('input', (input) => {
            const amount = inputElement.value;
            console.log('Table amount =', amount);
            store(id, amount);
            computeTotal();
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
    const inputExpenses = document.querySelectorAll('input.expense-input');
    for(const input of inputExpenses) {
        const key = input.id;
        const value = localStorage.getItem(key);
        input.value = value;
        console.log(`   Load from storage (${key}, ${value})`);
    }
}

function computeTotal() {
    const outputTotal = document.getElementById('output-total');
    const inputExpenses = document.querySelectorAll('input.expense-input');
    let total = 0.0;
    inputExpenses.forEach(expense => {
        const amount = expense.value === '' ? 0 : parseInt(expense.value);
        total += parseInt(amount);
    });
    outputTotal.textContent = `${currency}${total.toFixed(2)}`;
    console.log('Compute total = ', total);
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

console.log('Successful');
