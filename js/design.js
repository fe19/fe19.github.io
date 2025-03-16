const button = document.getElementById('button-generate');   // TODO rename id to buttonGenerate
const textFieldGeneration = document.getElementById('text-field-generation-description');


function drawDesign(canvas) {
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = '#0dcaf0';
    ctx.fillRect(50, 50, 300, 300);
}

function toggleVisibility(divId) {
    const div = document.getElementById(divId);
    if(div.style.display === "none" || div.style.display === "") {
        div.style.display = "block"; // show the div
    } else {
        div.style.display = "none"; // hide the div
    }
}

button.addEventListener('click', function () {
    const canvasContainer = document.getElementById('canvasContainer');
    const canvasDesign = document.getElementById('canvasDesign');

    const nbrRooms = document.getElementById('input-design-rooms').value;
    const area = document.getElementById('input-design-area').value;
    const floor = document.getElementById('input-design-floor').value;
    textFieldGeneration.textContent = `Generated a design with ${nbrRooms} rooms on ${area} m2 on the ${floor} floor`;

    if (canvasContainer.style.display === 'none') {
        canvasContainer.style.display = 'flex';
    } else {
        canvasContainer.style.display = 'none';
    }
    // drawDesign(canvasDesign);
    toggleVisibility("text-field-generation-description");
    toggleVisibility("image3D");
})

// Experimental
// var bsButton = new bootstrap.Button(button)
// bsButton.toggle()
