const button = document.getElementById('button-generate')
const textFieldGeneration = document.getElementById('text-field-generation-description')

button.addEventListener('click', function () {
    const nbrRooms = document.getElementById('input-design-rooms').value;
    const area = document.getElementById('input-design-area').value;
    const floor = document.getElementById('input-design-floor').value;
    textFieldGeneration.textContent = `Generated a design with ${nbrRooms} rooms on ${area} m2 on the ${floor} floor`;
})

var bsButton = new bootstrap.Button(button)
// bsButton.toggle() //
