const inputPerson1Name = document.getElementById('input-person1-name');
const inputPerson2Name = document.getElementById('input-person2-name');
const outputPerson1Name = document.getElementById('output-person1-name');
const outputPerson2Name = document.getElementById('output-person2-name');

inputPerson1Name.addEventListener('input', (event) => {
    const name = inputPerson1Name.value;
    outputPerson1Name.textContent = `${name} spent`;
});

inputPerson2Name.addEventListener('input', (event) => {
    const name = inputPerson2Name.value;
    outputPerson2Name.textContent = `${name} spent`;
});
