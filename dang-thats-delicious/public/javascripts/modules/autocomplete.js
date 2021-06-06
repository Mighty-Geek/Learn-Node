function autocomplete(input, latInput, lngInput) {
    if (!input) return;
    const dropdown = new google.maps.places.Autocomplete(input);
    dropdown.addListener('place-changed', () => {
        const place = dropdown.ggetPlace();
        latInput.value = place.geometry.location.lat();
        lngInput.value = place.geometry.location.lng();
    });
    // if someone hits enter on the address field do not submit the whole form
    input.on('keydown', (e) => {
        if (e.keyCode === 13) e.preventDefault();
    });
}

export default autocomplete;