const inputPersonName1 = document.getElementById('input-person1-name');
const inputPersonName2 = document.getElementById('input-person2-name');
const outputPersonName1 = document.getElementById('output-person1-name');
const outputPersonName2 = document.getElementById('output-person2-name');

function addListenerPerson(inputPerson, outputPerson) {
    inputPerson.addEventListener('input', () => {
        const name = inputPerson.value;
        outputPerson.textContent = `${name} spent`;
    });
}

addListenerPerson(inputPersonName1, outputPersonName1);
addListenerPerson(inputPersonName2, outputPersonName2);

