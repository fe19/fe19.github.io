const inputPersonName1 = document.getElementById('input-person1-name');
const inputPersonName2 = document.getElementById('input-person2-name');
const outputPersonName1 = document.getElementById('output-person1-name');
const outputPersonName2 = document.getElementById('output-person2-name');

const outputTotal = document.getElementById('output-total');
const outputPerson1 = document.getElementById('output-person1');
const outputPerson2 = document.getElementById('output-person2');

function addListenerPerson(inputPerson, outputPerson) {
    inputPerson.addEventListener('input', () => {
        const name = inputPerson.value;
        outputPerson.textContent = `${name} spent`;
        console.log('Registered input listener for', inputPerson);
        console.log('Registered output listener for', outputPerson);
    });
}

function computeTotal(outputTotal, inputClass) {
    const inputExpenses = document.querySelectorAll('input.' + inputClass);
    console.log('inputExpenses: ', inputExpenses);
    let total = 0.0;
    inputExpenses.forEach(expense => {
        total += parseInt(expense.placeholder);
    });
    outputTotal.textContent = `$${total.toFixed(2)}`;
    console.log('Computed total = ', total);
}

addListenerPerson(inputPersonName1, outputPersonName1);
addListenerPerson(inputPersonName2, outputPersonName2);

computeTotal(outputTotal, 'expense-input');
