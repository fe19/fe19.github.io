let currency = '€';
let isNightModeActive = false;

function listenerInputPerson(inputPerson) {
    inputPerson.addEventListener('input', () => {
        const id = inputPerson.id;
        const idSuffix = getInputSuffix(id);
        const value = inputPerson.value;
        store(idSuffix, value);
        updateNames(idSuffix, value);
        updateTableNames(idSuffix, value);
    });
}

function updateNames(idSuffix, value) {
    const idEnding = idSuffix.split('-').pop();
    if (idEnding !== 'name') {
        return;
    }
    const idPays = 'output-' + idSuffix;
    const fieldPays = document.getElementById(idPays);
    fieldPays.textContent = `${value} pays`;
    const idPayed = 'output-paid-' + idSuffix;
    const fieldPayed = document.getElementById(idPayed);
    fieldPayed.textContent = `${value} payed`;
    console.log(`Update ${fieldPayed.idPays} = ${value}`);
}

function updateSelectNames(i) {
    const configElement = document.getElementById(`input-person${i}-name`);
    const options = document.querySelectorAll('option.name' + i);
    options.forEach( function(option) {
        option.text = configElement.value;
    });
}

function updateInput(idSuffix, value) {
    const id = 'input-' + idSuffix;
    const element = document.getElementById(id);
    element.value = value;
    console.log(`Update element ${id} = ${value}`);
}

function updateTableNames(idSuffix, name) {
    const idEnding = idSuffix.split('-').pop();
    if(idEnding !== 'name') {
        return;
    }
    const split = idSuffix.split('-');
    const index = split[0].substring(6);
    const person = document.getElementById('table-header-person' + index);
    person.textContent = `${name} %`;
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
    const inputElements = document.getElementsByClassName('input-configuration'); // [input-person1-name, input-person2-name]
    for (const inputElement of inputElements) {
        const key = getInputSuffix(inputElement.id);
        const value = localStorage.getItem(key);
        updateInput(key, value);
        updateNames(key, value);
        updateTableNames(key, value);
        updateSelectNames(1);
        updateSelectNames(2);
    }
}

function getPersonName(i) {
    console.log('Person =', document.getElementById(`input-person${i}-name`).value); // TODO remove comment
    return document.getElementById(`input-person${i}-name`).value;
}

function loadTable() {
    const inputExpenses = document.querySelectorAll('input.modifiable-table-element');
    for (const input of inputExpenses) {
        const key = input.id;
        const value = localStorage.getItem(key);
        input.value = value;
    }
    const modifiableSelects = document.querySelectorAll('select.modifiable-table-element');
    for (const select of modifiableSelects) {
        const key = select.id;
        const value = localStorage.getItem(key);
        // select.value = value; TODO activate
        console.log('TEST Loaded value = ' + value);
    }
}

function computeTotal() {
    const outputTotal = document.getElementById('output-total');
    const inputExpenses = document.querySelectorAll('input.amount');
    let total = 0.0;
    inputExpenses.forEach(expense => {
        const amount = expense.value === '' ? 0 : parseInt(expense.value);
        total += parseInt(amount);
    });
    outputTotal.textContent = `${currency}${total.toFixed(2)}`;
    console.log('Compute total amount = ', total);
}


function computePersonsPaid() {
    const outputPaidPerson1 = document.getElementById('output-paid-person1');
    const outputPaidPerson2 = document.getElementById('output-paid-person2');
    const person1 = document.getElementById('input-person1-name').value;
    const person2 = document.getElementById('input-person2-name').value;
    const selectPays = document.querySelectorAll('select.paid');
    let totalPaid1 = 0.0;
    let totalPaid2 = 0.0;
    let i = 1;
    selectPays.forEach(selectPaid => {
        // TODO Verify implementation
        const selectedPerson = selectPaid.options[selectPaid.selectedIndex].text;
        const amountElement = document.getElementById('amount' + i);
        const amount = amountElement.value == '' ? 0 : parseInt(amountElement.value);
        if(selectedPerson == person1) totalPaid1 += amount;
        if(selectedPerson == person2) totalPaid2 += amount;
        i++;
    });
    outputPaidPerson1.textContent = `${currency}${totalPaid1.toFixed(2)}`;
    outputPaidPerson2.textContent = `${currency}${totalPaid2.toFixed(2)}`;
    console.log('Compute person1 paid = ' + totalPaid1 + ' person2 paid = ' + totalPaid2);
}

function computePersons() {
    const outputPerson1 = document.getElementById('output-person1');
    const outputPerson2 = document.getElementById('output-person2');
    const inputExpenses = document.querySelectorAll('input.amount');
    let total1 = 0.0;
    let total2 = 0.0;
    let i = 1;
    inputExpenses.forEach(expense => {
        const amount = expense.value === '' ? 0 : parseInt(expense.value);
        const percentage1Field = document.getElementById('percentageFirst' + i);
        const percentage2Field = document.getElementById('percentageSecond' + i);
        const percentage1 = percentage1Field.value === '' ? 0 : parseInt(percentage1Field.value);
        const percentage2 = percentage2Field.value === '' ? 0 : parseInt(percentage2Field.value);
        total1 += parseInt(amount) * parseInt(percentage1) / 100.0;
        total2 += parseInt(amount) * parseInt(percentage2) / 100.0;
        i++;
    });
    outputPerson1.textContent = `${currency}${total1.toFixed(2)}`;
    outputPerson2.textContent = `${currency}${total2.toFixed(2)}`;
    console.log('Compute person1 amount = ' + total1 + ' person2 amount = ' + total2);
}

function activateNightMode() {
    var now = new Date();
    var hours = now.getHours();
    const inputElements = document.querySelectorAll('.input-group, .input-group-text, .form-control, .form-select, .table, td, .text-body-emphasis');
    if (hours >= 21 || hours <= 5) {
        for (inputElement of inputElements) {
            inputElement.classList.add('color-night');
        }
        document.body.style.background = "#355C7D";
        document.body.style.color = "white";
        console.log('Switch to night mode');
        isNightModeActive = true;
    } else {
        isNightModeActive = false;
    }
}

function getInputSuffix(id) {
    return id.substring(6); // input-person1-name -> person1-name
}

function getOutputSuffix(id) {
    return id.substring(7); // output-person1-name -> person1-name
}

function validatePercentage(percentage1, percentage2) {
    // TODO simplify functions
}

function validatePercentageElements(inputElementListener, inputElementOther) {
    const percentage1 = parseInt(inputElementListener.value);
    const percentage2 = parseInt(inputElementOther.value);
    const sum = percentage1 + percentage2;
        if(sum > 100) {
            console.log('percentage > 100%');
            inputElementListener.style.setProperty('background', 'yellow', 'important');
            inputElementOther.style.setProperty('background', 'yellow', 'important');
            if(isNightModeActive) {
                inputElementListener.style.setProperty('color', 'black', 'important');
                inputElementOther.style.setProperty('color', 'black', 'important');
            }
        } else {
            inputElementListener.style.backgroundColor = 'white';
            inputElementOther.style.backgroundColor = 'white';
            if(isNightModeActive) {
                inputElementListener.style.setProperty('color', 'white', 'important');
                inputElementOther.style.setProperty('color', 'white', 'important');
            }
        }
}

function validatePercentage(inputElementListener, inputElementOther) {
    // Validate on initial page load
    validatePercentageElements(inputElementListener, inputElementOther);
    inputElementListener.addEventListener('input', (input) => {
        validatePercentageElements(inputElementListener, inputElementOther)
    });
}

function validatePercentages() {
    const inputPercentagePerson1 = document.getElementById('input-person1-percentage');
    const inputPercentagePerson2 = document.getElementById('input-person2-percentage');
    validatePercentage(inputPercentagePerson1, inputPercentagePerson2);
    validatePercentage(inputPercentagePerson2, inputPercentagePerson1);
}

function generateTextCol(i, text, type, width) {
    const col = document.createElement('td');
    const input = document.createElement('input');
    const id = text + i;
    input.id = id;
    input.type = type;
    input.classList.add('form-control');
    input.classList.add(text);
    input.classList.add('modifiable-table-element');
    col.appendChild(input);
    col.style.width = width;
    return col;
}

function generateSelectCol(i, text, optionName1, optionName2, width) {
    const col = document.createElement('td');
    const select = document.createElement('select');
    const id = text + i;
    select.id = id;
    select.classList.add('form-select');
    select.classList.add(text);
    select.classList.add('modifiable-table-element');
    const option1 = document.createElement('option');
    const option2 = document.createElement('option');
    option1.value = '1';
    option2.value = '2';
    option1.text = optionName1;
    option2.text = optionName2;
    option1.classList.add('name1');
    option2.classList.add('name2');
    select.appendChild(option1);
    select.appendChild(option2);
    col.appendChild(select);
    col.style.width = width;
    return col;
}

function generateTable(nbrRows) {
    const table = document.getElementById('tableCosts');

    // Build header
    const headRow = document.createElement('tr');
    const th1 = document.createElement('th');
    const th2 = document.createElement('th');
    const th3 = document.createElement('th');
    const th4 = document.createElement('th');
    const th5 = document.createElement('th');
    const th6 = document.createElement('th');
    th1.classList.add('input-group-lg');
    th1.textContent = 'Description';
    th2.textContent = 'Amount';
    th3.textContent = 'Paid by';
    th4.textContent = 'Date';
    th5.textContent = 'Percentage P1';
    th6.textContent = 'Percentage P2';
    th5.id = 'table-header-person1';
    th6.id = 'table-header-person2';
    headRow.appendChild(th1);
    headRow.appendChild(th2);
    headRow.appendChild(th3);
    headRow.appendChild(th4);
    headRow.appendChild(th5);
    headRow.appendChild(th6);
    table.appendChild(headRow);

    const p1 = getPersonName(1);
    const p2 = getPersonName(2);

    // build body
    for (let i = 1; i < nbrRows; i++) {
        const row = document.createElement('tr');
        const col1 = generateTextCol(i, 'description', 'text', '40%');
        const col2 = generateTextCol(i, 'amount', 'number', '10%');
        const col3 = generateSelectCol(i, 'paid', p1, p2, '10%');
        const col4 = generateTextCol(i, 'date', 'text', '10%');
        const col5 = generateTextCol(i, 'percentageFirst', 'number', '10%');
        const col6 = generateTextCol(i, 'percentageSecond', 'number', '10%');
        row.appendChild(col1);
        row.appendChild(col2);
        row.appendChild(col3);
        row.appendChild(col4);
        row.appendChild(col5);
        row.appendChild(col6);
        table.appendChild(row);
    }
}

function getToday() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${day}.${month}.${year}`;
}

function autoFill(id) {
    const i = id.match(/\d+$/);
    const descriptionId = 'description' + i;
    const description = document.getElementById('description' + i);
    const dateId = 'date' + i;
    const percentagePerson1Id = 'percentageFirst' + i;
    const percentagePerson2Id = 'percentageSecond' + i;
    const dateElement = document.getElementById(dateId);
    const percentagePerson1Element = document.getElementById(percentagePerson1Id);
    const percentagePerson2Element = document.getElementById(percentagePerson2Id);
    const date = getToday();
    const percentagePerson1 = document.getElementById('input-person1-percentage');
    const percentagePerson2 = document.getElementById('input-person2-percentage');
    if (description.value === '') {
        console.log('Description is empty');
        dateElement.value = '';
        percentagePerson1Element.value = '';
        percentagePerson2Element.value = '';
    } else {
        dateElement.value = date;
        percentagePerson1Element.value = percentagePerson1.value;
        percentagePerson2Element.value = percentagePerson2.value;
        store(dateElement.id, date);
        store(percentagePerson1Element.id, percentagePerson1.value);
        store(percentagePerson2Element.id, percentagePerson2.value);
    }

    console.log(`Autofill ${dateId}=${date} ${percentagePerson1Id}=${percentagePerson1} ${percentagePerson2Id}=${percentagePerson2}`);
}

function autoErase(i) {
    const dateElement = document.getElementById('date' + i);
    const percentagePerson1Element = document.getElementById('percentageFirst' + i);
    const percentagePerson2Element = document.getElementById('percentageSecond' + i);
    dateElement.value = '';
    percentagePerson1Element.value = '';
    percentagePerson2Element.value = '';
    store(dateElement.id, '');
    store(percentagePerson1Element.id, '');
    store(percentagePerson2Element.id, '');

    console.log(`Auto Erase ${dateElement.id}=${dateElement.value} ${percentagePerson1Element.id}=${percentagePerson1Element.value} ${percentagePerson2Element.id}=${percentagePerson2Element.value}`);
}

generateTable(20);
loadInitial();
loadTable();

activateNightMode();

const inputElements = document.getElementsByClassName('input-configuration');
for (const inputElement of inputElements) {
    listenerInputPerson(inputElement);
}

function addEventListenerConfigName(i) {
    const configElement = document.getElementById(`input-person${i}-name`);
    configElement.addEventListener('input', (input) => {
        const options = document.querySelectorAll('option.name' + i);
        options.forEach( function(option) {
        option.text = configElement.value;
        });
    });
}

// React on changes inside the table
const inputTableElements = document.querySelectorAll('input.modifiable-table-element');
for (const inputElement of inputTableElements) {
    const id = inputElement.id;
    inputElement.addEventListener('input', (input) => {
        const value = inputElement.value;
        store(id, value);
        computeTotal();
        computePersonsPaid();
        computePersons();
    });
}
const selectTableElements = document.querySelectorAll('select.modifiable-table-element');
for(const selectElement of selectTableElements) {
    const id = selectElement.id;
    selectElement.addEventListener('change', (select) => {
        const value = selectElement.value
        console.log('TEST Store Selection (' + id + ' ' + value + ')');
        store(id, value);
        computePersonsPaid();
    });
}

// React on changes of the description column in the table
const inputTableDescription = document.querySelectorAll('input.description');
for (const inputElement of inputTableDescription) {
    inputElement.addEventListener('input', (input) => {
        const id = inputElement.id;
        const value = inputElement.value;
        const i = id.match(/\d+$/);
        const descriptionField = document.getElementById('description' + i);
        const amountField = document.getElementById('amount' + i);
        const dateField = document.getElementById('date' + i);
        const percentageFirstField = document.getElementById('percentageFirst' + i);
        const percentageSecondField = document.getElementById('percentageSecond' + i);
        const isDateEmpty = dateField.value === '';
        const isPercentage1Empty = percentageFirstField.value === '';
        const isPercentage2Empty = percentageSecondField.value === '';
        if(isDateEmpty && isPercentage1Empty && isPercentage2Empty) {
            autoFill(id);
        }
        if(descriptionField.value == '' && amountField.value == '') {
            autoErase(i);
        }
        validatePercentage(percentageFirstField, percentageSecondField);
        validatePercentage(percentageSecondField, percentageFirstField);
    });
}

// React on changes or the percentage column of the table
const inputTablePercentage = document.querySelectorAll('input.percentageFirst');
for(const inputElement of inputTablePercentage) {
    const firstId = inputElement.id;
    const secondId = firstId.replace('First', 'Second');
    const percentageFirst = document.getElementById(firstId);
    const percentageSecond = document.getElementById(secondId);
    validatePercentage(percentageFirst, percentageSecond);
    validatePercentage(percentageSecond, percentageFirst);
}

const inputCurrency = document.getElementById('input-currency');
inputCurrency.addEventListener('input', (input) => {
    currency = inputCurrency.value;
    computeTotal();
    computePersonsPaid();
    computePersons();
});

const inputNumberRows = document.getElementById('input-number-rows');
inputNumberRows.addEventListener('input', (input) => {
    const numberRows = inputNumberRows.value;
});

const configName1 = document.getElementById('input-person1-name');
configName1.addEventListener('input', (input) => {
    const options = document.querySelectorAll('option.name1');
    options.forEach( function(option) {
        option.text = configName1.value;
    });
});

addEventListenerConfigName(1);
addEventListenerConfigName(2);


computeTotal();
computePersonsPaid();
computePersons();
validatePercentages();

console.log('Successful execution of budget.js');
