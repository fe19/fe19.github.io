const inputElements = document.getElementsByClassName('input-configuration'); // [input-person1-name, input-person2-name]
const outputElementsModifiable = document.getElementsByClassName('output-name-modifiable'); // [output-person1-name, output-person2-name]

const outputTotal = document.getElementById('output-total');
const outputPerson1 = document.getElementById('output-person1');
const outputPerson2 = document.getElementById('output-person2');

function listenerInputPerson(inputPerson) {
    inputPerson.addEventListener('input', () => {
        const id = inputPerson.id;
        const idSuffix = getInputSuffix(id);
        const value = inputPerson.value;
        store(idSuffix, value);
        updateField(idSuffix, value);
    });
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

function computeTotal(outputTotal, inputClass) {
    const inputExpenses = document.querySelectorAll('input.' + inputClass);
    console.log('inputExpenses: ', inputExpenses);
    let total = 0.0;
    inputExpenses.forEach(expense => {
        total += parseInt(expense.placeholder);
    });
    outputTotal.textContent = `$${total.toFixed(2)}`;
    console.log('Compute total = ', total);
}

function activateNightMode() {
    console.log('Register night mode');
    var now = new Date();
    var hours = now.getHours();
    if(hours >= 20 || hours <= 5) {
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

activateNightMode();

for(const inputElement of inputElements) {
    listenerInputPerson(inputElement);
}

computeTotal(outputTotal, 'expense-input');
