document.addEventListener('DOMContentLoaded', function () {
    // Map initialization
    const map = L.map('map').setView([30.3165, 78.0322], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // State variables
    let hospitals = {};
    let userCoords = null;
    let routeControl = null;
    let userMarker = null;

    // DOM elements
    const endHospitalSelect = document.getElementById('end-hospital-select');
    const hospitalSelect = document.getElementById('hospital-select');
    const findRouteBtn = document.querySelector('.findRouteBtn');
    const routeToSelectedBtn = document.querySelector('.routeToSelectedBtn');
    const thirdPartyRouteBtn = document.querySelector('.thirdPartyRouteBtn');

    // Load hospital data
    async function loadHospitals() {
        try {
            const response = await fetch('/hospitals');
            const data = await response.json();
            
            if (!Array.isArray(data)) {
                throw new Error('Invalid hospital data format');
            }

            // Clear and populate select elements
            const selectElements = [hospitalSelect, endHospitalSelect];
            selectElements.forEach(select => {
                select.innerHTML = '<option value="" disabled selected>Select Hospital</option>';
            });

            // Process hospital data
            data.forEach(hospital => {
                const name = hospital["Hospital Name"];
                const lat = parseFloat(hospital.Latitude);
                const lon = parseFloat(hospital.Longitude);

                // Store hospital data
                hospitals[name] = { lat, lon };

                // Add to select elements
                selectElements.forEach(select => {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    select.appendChild(option);
                });

                // Add marker to map
                L.marker([lat, lon]).addTo(map)
                    .bindPopup(`<b>${name}</b>`);
            });
        } catch (error) {
            console.error('Error loading hospitals:', error);
            alert('Failed to load hospital data. Please try again.');
        }
    }

    // Get and display user location
    async function getUserLocation() {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser");
            return;
        }

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000
                });
            });

            userCoords = {
                lat: position.coords.latitude,
                lon: position.coords.longitude
            };

            // Update map view
            map.setView([userCoords.lat, userCoords.lon], 14);

            // Remove previous marker if exists
            if (userMarker) {
                map.removeLayer(userMarker);
            }

            // Add new user marker
            userMarker = L.marker([userCoords.lat, userCoords.lon], {
                icon: L.icon({
                    iconUrl: "https://cdn-icons-png.flaticon.com/512/64/64113.png",
                    iconSize: [32, 32],
                    iconAnchor: [16, 32],
                    popupAnchor: [0, -30]
                }),
                zIndexOffset: 1000
            }).addTo(map)
              .bindPopup("<b>You are here</b>")
              .openPopup();

        } catch (error) {
            console.error("Geolocation error:", error);
            alert("Could not get your location. Please enable location permissions.");
        }
    }

    // Show route on map
    function showRoute(from, to) {
        // Clear previous route
        if (routeControl) {
            map.removeControl(routeControl);
            routeControl = null;
        }

        // Create new route
        routeControl = L.Routing.control({
            waypoints: [
                L.latLng(from.lat, from.lon),
                L.latLng(to.lat, to.lon)
            ],
            routeWhileDragging: false,
            showAlternatives: false,
            addWaypoints: false,
            lineOptions: {
                styles: [{ 
                    color: '#0066ff', 
                    weight: 5, 
                    opacity: 0.7 
                }]
            },
            createMarker: function() { return null; } // Disable default markers
        }).addTo(map);

        // Zoom to fit the route
        map.fitBounds([
            [from.lat, from.lon],
            [to.lat, to.lon]
        ], { padding: [50, 50] });
    }

    // Find nearest hospital
    async function findNearestHospital() {
        if (!userCoords) {
            alert("Your location is not available. Please enable location services.");
            return;
        }

        try {
            const response = await fetch(`/nearest?lat=${userCoords.lat}&lon=${userCoords.lon}`);
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            if (!data.route || data.route.length < 2) {
                throw new Error("No route found");
            }

            const start = { lat: data.route[0][0], lon: data.route[0][1] };
            const end = { 
                lat: data.route[data.route.length - 1][0], 
                lon: data.route[data.route.length - 1][1] 
            };

            showRoute(start, end);
            alert(`Nearest hospital: ${data.nearest_hospital}\nDistance: ${data.distance} km`);

        } catch (error) {
            console.error('Error finding nearest hospital:', error);
            alert(`Failed to find nearest hospital: ${error.message}`);
        }
    }

    // Route to selected hospital
    async function routeToSelectedHospital() {
        const selectedName = hospitalSelect.value;
        
        if (!selectedName) {
            alert("Please select a hospital first");
            return;
        }

        if (!userCoords) {
            alert("Your location is not available");
            return;
        }

        const hospital = hospitals[selectedName];
        if (!hospital) {
            alert("Selected hospital data not found");
            return;
        }

        showRoute(userCoords, hospital);
    }

    // Third-party routing
    async function calculateThirdPartyRoute(startLat, startLng, endHospital) {
        try {
            const response = await fetch('/find-route-from-coords', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    start: { lat: startLat, lng: startLng },
                    endHospital: endHospital
                }),
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            if (!data.route || data.route.length < 2) {
                throw new Error("No route found");
            }

            const start = { lat: data.route[0][0], lon: data.route[0][1] };
            const end = { 
                lat: data.route[data.route.length - 1][0], 
                lon: data.route[data.route.length - 1][1] 
            };

            showRoute(start, end);
            alert(`Route to ${data.hospital}\nDistance: ${data.distance} km`);

        } catch (error) {
            console.error('Error calculating route:', error);
            alert(`Failed to calculate route: ${error.message}`);
        }
    }

    // Event listeners
    findRouteBtn.addEventListener('click', findNearestHospital);
    routeToSelectedBtn.addEventListener('click', routeToSelectedHospital);
    thirdPartyRouteBtn.addEventListener('click', () => {
        const startLocation = document.getElementById('start-location').value;
        const endHospital = endHospitalSelect.value;
        
        if (!startLocation || !endHospital) {
            alert('Please enter both start location and select a hospital');
            return;
        }
        
        const coordPattern = /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/;
        if (coordPattern.test(startLocation)) {
            const [lat, lng] = startLocation.split(',').map(coord => parseFloat(coord.trim()));
            calculateThirdPartyRoute(lat, lng, endHospital);
        } else {
            alert('Please use coordinates in "lat,lng" format.');
        }
    });

    // Initialize
    loadHospitals();
    getUserLocation();
    checkForSharedLocation();
});

// Location sharing functions 
function openShareLocationPopup() {
    document.getElementById('shareLocationPopup').style.display = 'flex';
    document.getElementById('locationLink').value = window.location.href.split('?')[0] + '?shareLocation=true';
}

function closeShareLocationPopup() {
    document.getElementById('shareLocationPopup').style.display = 'none';
}

function copyLocationLink() {
    const copyText = document.getElementById("locationLink");
    copyText.select();
    document.execCommand("copy");
    alert("Link copied to clipboard!");
}

document.getElementById('shareLocationBtn').addEventListener('click', function() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const result = document.getElementById('locationResult');
                
                result.innerHTML = `
                    <p>Location shared successfully!</p>
                    <p>Latitude: ${lat.toFixed(6)}</p>
                    <p>Longitude: ${lng.toFixed(6)}</p>
                `;
                result.style.display = 'block';
                
                document.getElementById('locationLink').value = 
                    `${window.location.href.split('?')[0]}?lat=${lat}&lng=${lng}`;
            },
            error => {
                const result = document.getElementById('locationResult');
                result.innerHTML = `<p>Error: ${error.message}</p>`;
                result.style.display = 'block';
            }
        );
    } else {
        alert("Geolocation not supported");
    }
});

function checkForSharedLocation() {
    const urlParams = new URLSearchParams(window.location.search);
    const lat = urlParams.get('lat');
    const lng = urlParams.get('lng');
    
    if (lat && lng) {
        document.getElementById('start-location').value = `${lat},${lng}`;
        alert('Location loaded from shared link. Select a hospital and click "Calculate Route".');
    }
}

const coordsFromURL = getCoordsFromURL();

if (coordsFromURL) {
  // Use these coordinates for nearest hospital calculation
  fetch(`/nearest?lat=${coordsFromURL.lat}&lon=${coordsFromURL.lon}`)
    .then(res => res.json())
    .then(data => {
      // Display route on map
      console.log('Nearest hospital route:', data);
      drawRouteOnMap(data.route); 
    })
    .catch(err => console.error('Error fetching nearest hospital from shared location:', err));
}

navigator.geolocation.getCurrentPosition(pos => {
  const lat = pos.coords.latitude;
  const lon = pos.coords.longitude;
  const shareLink = `${window.location.origin}/index?lat=${lat}&lon=${lon}`;
  prompt("Share this link:", shareLink);
});
