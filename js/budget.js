const inputPersonName1 = document.getElementById('input-person1-name');
const inputPersonName2 = document.getElementById('input-person2-name');
const outputPersonName1 = document.getElementById('output-person1-name');
const outputPersonName2 = document.getElementById('output-person2-name');

const outputTotal = document.getElementById('output-total');
const outputPerson1 = document.getElementById('output-person1');
const outputPerson2 = document.getElementById('output-person2');

function listenerPerson(inputPerson, outputPerson) {
    inputPerson.addEventListener('input', () => {
        const value = inputPerson.value;
        updateOutput(outputPerson, value);
        store(inputPerson.id, value);
    });
}

function updateOutput(outputPerson, value) {
    outputPerson.textContent = `${value} spent`;
    console.log(`Update ${outputPerson.id} = ${value}`);
}

function store(key, value) {
    localStorage.setItem(key, value);
    console.log(`Store (${key}, ${value})`);
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

function nightMode() {
    var now = new Date();
    var hours = now.getHours();
    if(hours >= 20 || hours <= 5) {
        console.log('Switched to night mode');
        document.body.style.background = "#355C7D";
        document.body.style.color = "white";
    }
}

listenerPerson(inputPersonName1, outputPersonName1);
listenerPerson(inputPersonName2, outputPersonName2);

computeTotal(outputTotal, 'expense-input');

nightMode();
