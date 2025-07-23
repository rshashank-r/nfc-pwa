// --- Global Variables & DOM Elements ---
const DB_NAME = 'nfcContactDB';
const DB_VERSION = 1; // Increment this when changing schema
let db; // IndexedDB instance

// Sections
const profileSection = document.getElementById('profileSection');
const shareSection = document.getElementById('shareSection');
const receivedSection = document.getElementById('receivedSection');

// Navigation Buttons
const navProfileBtn = document.getElementById('navProfileBtn');
const navShareBtn = document.getElementById('navShareBtn');
const navReceivedBtn = document.getElementById('navReceivedBtn');

// Profile Form & Display
const profileForm = document.getElementById('profileForm');
const fullNameInput = document.getElementById('fullName');
const mobileInput = document.getElementById('mobile');
const emailInput = document.getElementById('email');
const companyInput = document.getElementById('company');
const jobTitleInput = document.getElementById('jobTitle');
const linkedinInput = document.getElementById('linkedin');

const displayFullName = document.getElementById('displayFullName');
const displayMobile = document.getElementById('displayMobile');
const displayEmail = document.getElementById('displayEmail');
const displayCompany = document.getElementById('displayCompany');
const displayJobTitle = document.getElementById('displayJobTitle');
const displayLinkedIn = document.getElementById('displayLinkedIn');

// Share Section
const shareNFCBtn = document.getElementById('shareNFCBtn');
const nfcStatus = document.getElementById('nfcStatus');
const qrcodeDiv = document.getElementById('qrcode');
let qrcode = null; // To hold the QR code instance

// Received Contacts Section
const nfcReceiveStatus = document.getElementById('nfcReceiveStatus');
const startNFCReceiveBtn = document.getElementById('startNFCReceiveBtn');
const contactListUl = document.getElementById('contactList');
let nfcReader = null; // To hold the NDEFReader instance

// Contact Details Modal
const contactDetailsModal = document.getElementById('contactDetailsModal');
const modalFullName = document.getElementById('modalFullName');
const modalMobile = document.getElementById('modalMobile');
const modalEmail = document.getElementById('modalEmail');
const modalCompany = document.getElementById('modalCompany');
const modalJobTitle = document.getElementById('modalJobTitle');
const modalLinkedIn = document.getElementById('modalLinkedIn');
const saveToAppBtn = document.getElementById('saveToAppBtn');
const exportVCFBtn = document.getElementById('exportVCFBtn');
const closeModalBtn = document.querySelector('.close-button');

let currentDisplayedContact = null; // Store contact for modal actions

// PWA Install Prompt elements
const installAppBtn = document.getElementById('installAppBtn');
const installPromptStatus = document.getElementById('installPromptStatus');
let deferredPrompt; // To store the beforeinstallprompt event


// --- PWA Service Worker Registration ---
// Adjust scope for GitHub Pages project pages (e.g., '/your-repo-name/')
const serviceWorkerScope = '/'; // Change to '/your-repo-name/' if applicable

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register(`${serviceWorkerScope}service-worker.js`, { scope: serviceWorkerScope })
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    });
}

// --- PWA Install Prompt Logic ---
// Listen for the `beforeinstallprompt` event
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the default browser install prompt from appearing automatically
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    console.log('beforeinstallprompt event fired.');

    // Only show the install button if it's an Android device (Web NFC is Android-centric)
    // and if the app isn't already installed (handled by appinstalled listener later)
    if (isAndroidDevice()) {
        installAppBtn.style.display = 'block';
        installPromptStatus.textContent = 'Add this app to your home screen for quick access!';
    } else {
        // For iOS or other devices, provide instructions
        installPromptStatus.innerHTML = 'For iPhone users: Tap the <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTzIwIDE4djJhMiAyIDAgMCAxLTIgMkg0YTIgMiAwIDAgMS0yLTJWMTBhMiAyIDAgMCAxIDItMmgxNGEyIDIgMCAwIDEgMiAydi41bC0yLjkzLTIuOTNBMSAxIDAgMCAwIDE3IDdsLTIuMDctMi4wN0ExIDEgMCAwIDAgMTQgNGgtMi44MThhMiAyIDAgMCAwLTEuNzgyLjgyOEw2LjAxIDguNTczQTEgMSAwIDAgMCA1IDlsLS4xNS4xNUEyIDIgMCAwIDAgMiAxMXY3YTggOCAwIDAgMCA4IDhoMmE4IDggMCAwIDAgOC04eiIvPjwvc3ZnPg==" style="width: 1em; height: 1em; vertical-align: middle;"> (share) icon below and then "Add to Home Screen".';
    }
});

// Add a click listener to your custom install button
installAppBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
        // Hide the button once the prompt is shown (or dismissed)
        installAppBtn.style.display = 'none';
        installPromptStatus.textContent = 'Displaying install prompt...';

        // Show the browser's install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to install prompt: ${outcome}`);

        // Reset the deferredPrompt variable, as it can only be used once
        deferredPrompt = null;

        if (outcome === 'accepted') {
            installPromptStatus.textContent = 'App installed successfully! Launch from your home screen.';
            installPromptStatus.style.color = 'green';
        } else if (outcome === 'dismissed') {
            installPromptStatus.textContent = 'App installation dismissed. You can try again later.';
            installPromptStatus.style.color = 'orange';
            // You might want to re-show the button later or offer alternative instructions
            // For now, it stays hidden to avoid annoying the user immediately.
        }
    } else {
        installPromptStatus.textContent = 'Install prompt not available (already installed or criteria not met).';
        installPromptStatus.style.color = 'gray'; // Neutral color
    }
});

// Listen for the `appinstalled` event
window.addEventListener('appinstalled', () => {
    // Hide the install button if the app is already installed
    installAppBtn.style.display = 'none';
    installPromptStatus.textContent = 'App is already installed. Enjoy!';
    installPromptStatus.style.color = 'green';
    console.log('PWA was installed.');
});

// Basic device detection (for install prompt instructions)
function isAndroidDevice() {
    return /Android/i.test(navigator.userAgent);
}


// --- IndexedDB Functions ---
function openDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = function(event) {
            console.error('IndexedDB error:', event.target.errorCode);
            reject(event.target.errorCode);
        };

        request.onsuccess = function(event) {
            db = event.target.result;
            console.log('IndexedDB opened successfully');
            resolve(db);
        };

        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            // Create object store for user's own profile (single record)
            if (!db.objectStoreNames.contains('userProfile')) {
                db.createObjectStore('userProfile', { keyPath: 'id' });
            }
            // Create object store for received contacts
            if (!db.objectStoreNames.contains('receivedContacts')) {
                db.createObjectStore('receivedContacts', { keyPath: 'id', autoIncrement: true });
                // Optional: create indexes for faster lookups if needed
                // objectStore.createIndex('fullName', 'fullName', { unique: false });
            }
            console.log('Object stores created/updated');
        };
    });
}

async function saveUserProfile(profile) {
    if (!db) await openDb(); // Ensure DB is open
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['userProfile'], 'readwrite');
        const store = transaction.objectStore('userProfile');
        // We use a fixed ID 'myProfile' as there's only one user profile
        const request = store.put({ id: 'myProfile', ...profile });

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

async function loadUserProfile() {
    if (!db) await openDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['userProfile'], 'readonly');
        const store = transaction.objectStore('userProfile');
        const request = store.get('myProfile');

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function addReceivedContact(contact) {
    if (!db) await openDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['receivedContacts'], 'readwrite');
        const store = transaction.objectStore('receivedContacts');
        const request = store.add(contact);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

async function getReceivedContacts() {
    if (!db) await openDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['receivedContacts'], 'readonly');
        const store = transaction.objectStore('receivedContacts');
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// --- vCard Generation & Parsing ---

function generateVCard(profile) {
    let vcard = `BEGIN:VCARD\nVERSION:3.0\n`;
    if (profile.fullName) vcard += `FN:${profile.fullName}\n`;
    if (profile.mobile) vcard += `TEL;TYPE=CELL:${profile.mobile}\n`;
    if (profile.email) vcard += `EMAIL;TYPE=INTERNET:${profile.email}\n`;
    if (profile.company) vcard += `ORG:${profile.company}\n`;
    if (profile.jobTitle) vcard += `TITLE:${profile.jobTitle}\n`;
    if (profile.linkedin) vcard += `X-SOCIALPROFILE;type=linkedin;uri=${profile.linkedin}:${profile.linkedin}\n`; // Corrected LinkedIn format with URI
    vcard += `END:VCARD\n`;
    return vcard;
}

function parseVCard(vcardString) {
    const contact = {};
    const lines = vcardString.split(/\r\n|\n/); // Split by CRLF or LF

    lines.forEach(line => {
        if (line.startsWith('FN:')) contact.fullName = line.substring(3).trim();
        else if (line.startsWith('TEL;TYPE=CELL:')) contact.mobile = line.substring('TEL;TYPE=CELL:'.length).trim();
        else if (line.startsWith('EMAIL;TYPE=INTERNET:')) contact.email = line.substring('EMAIL;TYPE=INTERNET:'.length).trim();
        else if (line.startsWith('ORG:')) contact.company = line.substring(4).trim();
        else if (line.startsWith('TITLE:')) contact.jobTitle = line.substring(6).trim();
        // Updated parsing for LinkedIn to match updated generation
        else if (line.startsWith('X-SOCIALPROFILE;type=linkedin;uri=')) {
            // Extract the URL after 'uri=' and before the final colon
            const linkedinMatch = line.match(/uri=([^:]+):/);
            if (linkedinMatch && linkedinMatch[1]) {
                contact.linkedin = linkedinMatch[1].trim();
            } else {
                // Fallback for older formats or if URI part is missing
                contact.linkedin = line.substring(line.indexOf(':', 10) + 1).trim();
            }
        }
    });
    return contact;
}


// --- UI Management ---
function showSection(sectionId) {
    document.querySelectorAll('section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
}

async function displayCurrentProfile() {
    const profile = await loadUserProfile();
    if (profile) {
        fullNameInput.value = profile.fullName || '';
        mobileInput.value = profile.mobile || '';
        emailInput.value = profile.email || '';
        companyInput.value = profile.company || '';
        jobTitleInput.value = profile.jobTitle || '';
        linkedinInput.value = profile.linkedin || '';

        displayFullName.textContent = profile.fullName || 'N/A';
        displayMobile.textContent = profile.mobile || 'N/A';
        displayEmail.textContent = profile.email || 'N/A';
        displayCompany.textContent = profile.company || 'N/A';
        displayJobTitle.textContent = profile.jobTitle || 'N/A';
        displayLinkedIn.textContent = profile.linkedin || 'N/A';

        // Generate QR Code if on Share section
        if (shareSection.classList.contains('active')) {
            generateQRCodeForProfile(profile);
        }
    } else {
        // Clear forms and display if no profile
        profileForm.reset();
        displayFullName.textContent = 'N/A';
        displayMobile.textContent = 'N/A';
        displayEmail.textContent = 'N/A';
        displayCompany.textContent = 'N/A';
        displayJobTitle.textContent = 'N/A';
        displayLinkedIn.textContent = 'N/A';
    }
}

async function renderReceivedContacts() {
    const contacts = await getReceivedContacts();
    contactListUl.innerHTML = ''; // Clear previous list
    if (contacts && contacts.length > 0) {
        // Sort contacts by full name for better UX
        contacts.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));

        contacts.forEach(contact => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `<span class="contact-name">${contact.fullName || 'Unknown'}</span>`;
            listItem.dataset.contactId = contact.id; // Store ID for lookup
            listItem.addEventListener('click', () => showContactDetailsModal(contact));
            contactListUl.appendChild(listItem);
        });
    } else {
        contactListUl.innerHTML = '<li>No received contacts yet.</li>';
    }
}

function showContactDetailsModal(contact) {
    currentDisplayedContact = contact; // Store for save/export actions
    modalFullName.textContent = contact.fullName || 'N/A';
    modalMobile.textContent = contact.mobile || 'N/A';
    modalEmail.textContent = contact.email || 'N/A';
    modalCompany.textContent = contact.company || 'N/A';
    modalJobTitle.textContent = contact.jobTitle || 'N/A';
    modalLinkedIn.textContent = contact.linkedin || 'N/A';
    contactDetailsModal.style.display = 'block';
}

function hideContactDetailsModal() {
    contactDetailsModal.style.display = 'none';
    currentDisplayedContact = null;
}

// --- QR Code Generation ---
function generateQRCodeForProfile(profile) {
    if (!profile || (!profile.fullName && !profile.mobile && !profile.email)) { // QR requires at least some info
        qrcodeDiv.innerHTML = '<p>Save your profile with at least a name, phone, or email to generate QR code.</p>';
        return;
    }
    const vcardString = generateVCard(profile);
    qrcodeDiv.innerHTML = ''; // Clear previous QR code
    qrcode = new QRCode(qrcodeDiv, {
        text: vcardString,
        width: 180,
        height: 180,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });
}

// --- Web NFC API Integration (Android) ---
async function startNFCShare() {
    nfcStatus.textContent = 'Preparing to share via NFC... Tap devices together.';
    nfcStatus.style.color = '#007bff';

    const profile = await loadUserProfile();
    if (!profile || !profile.fullName) {
        nfcStatus.textContent = 'Error: Please save your profile with a name first!';
        nfcStatus.style.color = 'red';
        return;
    }

    // Check for NDEFReader support
    if (!('NDEFReader' in window)) {
        nfcStatus.textContent = 'Web NFC API not supported in this browser/device.';
        nfcStatus.style.color = 'orange';
        return;
    }

    const vcardString = generateVCard(profile);

    try {
        const reader = new NDEFReader();
        // The write() call initiates the process. The actual tap happens after this.
        await reader.write({
            records: [{
                recordType: "mime",
                mediaType: "text/vcard",
                data: new TextEncoder().encode(vcardString)
            }]
        });
        nfcStatus.textContent = 'Profile ready to share! Tap devices together to complete.';
        nfcStatus.style.color = 'green';
    } catch (error) {
        console.error('NFC Write Error:', error);
        nfcStatus.textContent = `NFC Share Failed: ${error.message}. Ensure NFC is on and permissions granted.`;
        nfcStatus.style.color = 'red';
    }
}

async function startNFCReceive() {
    // If a reader is already active, don't start another one
    if (nfcReader) {
        nfcReceiveStatus.textContent = 'Already listening for NFC contacts.';
        nfcReceiveStatus.style.color = 'orange';
        return;
    }

    // Check for NDEFReader support
    if (!('NDEFReader' in window)) {
        nfcReceiveStatus.textContent = 'Web NFC API not supported in this browser/device.';
        nfcReceiveStatus.style.color = 'orange';
        return;
    }

    nfcReceiveStatus.textContent = 'Listening for NFC contacts... Tap devices together.';
    nfcReceiveStatus.style.color = '#007bff';

    try {
        nfcReader = new NDEFReader(); // Initialize reader
        nfcReader.onreading = async event => {
            console.log('NFC data received:', event);
            nfcReceiveStatus.textContent = 'NFC contact received! Processing...';
            nfcReceiveStatus.style.color = 'green';

            let vcardFound = false;
            for (const record of event.message.records) {
                if (record.recordType === "mime" && record.mediaType === "text/vcard") {
                    const decoder = new TextDecoder();
                    const vcardString = decoder.decode(record.data);
                    console.log('Received vCard:', vcardString);
                    const receivedContact = parseVCard(vcardString);
                    if (Object.keys(receivedContact).length > 0) { // Ensure something was parsed
                        showContactDetailsModal(receivedContact);
                        vcardFound = true;
                        break; // Process first vCard found
                    }
                }
            }
            if (!vcardFound) {
                nfcReceiveStatus.textContent = 'Received NFC data, but no vCard found.';
                nfcReceiveStatus.style.color = 'orange';
            }
        };
        nfcReader.onreadingerror = error => {
            console.error('NFC Reading Error:', error);
            nfcReceiveStatus.textContent = `NFC Receive Error: ${error.message}. Ensure NFC is on and permissions granted.`;
            nfcReceiveStatus.style.color = 'red';
            // It's often good to re-scan or provide option to re-scan after an error
            // For now, let's keep it simple.
        };
        await nfcReader.scan(); // Start scanning
        // Status message will be updated by onreading or onreadingerror
    } catch (error) {
        console.error('NFC Scan Initialization Error:', error);
        nfcReceiveStatus.textContent = `Failed to start NFC scan: ${error.message}. Ensure NFC is on and permissions granted.`;
        nfcReceiveStatus.style.color = 'red';
        nfcReader = null; // Clear reader on error
    }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', async () => {
    await openDb(); // Open IndexedDB on app load
    displayCurrentProfile(); // Load and display profile on start
    renderReceivedContacts(); // Load and display received contacts

    // Navigation
    navProfileBtn.addEventListener('click', () => {
        showSection('profileSection');
        displayCurrentProfile(); // Refresh display
    });
    navShareBtn.addEventListener('click', () => {
        showSection('shareSection');
        displayCurrentProfile(); // Generate QR code for latest profile
        // On returning to share, clear NFC status
        nfcStatus.textContent = '';
        nfcStatus.style.color = '';
    });
    navReceivedBtn.addEventListener('click', () => {
        showSection('receivedSection');
        renderReceivedContacts(); // Refresh list
        // On returning to received, clear NFC status
        nfcReceiveStatus.textContent = '';
        nfcReceiveStatus.style.color = '';
        // Stop any ongoing NFC scan if user leaves the tab
        if (nfcReader) {
            // NDEFReader doesn't have a direct 'stop' method.
            // Its 'scan' promise resolves when scanning stops (e.g., app in background).
            // For PWA, if you want to explicitly stop, you'd typically manage this
            // by nullifying the onreading handler or recreating the reader.
            // For this MVP, we'll let it continue in background until browser decides to stop it.
            // A more robust solution for persistent background scanning or explicit stop
            // would involve more advanced Service Worker/browser lifecycle management.
        }
    });


    // Profile Form Submission
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const profile = {
            fullName: fullNameInput.value.trim(),
            mobile: mobileInput.value.trim(),
            email: emailInput.value.trim(),
            company: companyInput.value.trim(),
            jobTitle: jobTitleInput.value.trim(),
            linkedin: linkedinInput.value.trim(),
        };
        try {
            await saveUserProfile(profile);
            alert('Profile saved successfully!');
            displayCurrentProfile(); // Update display
            // Regenerate QR code immediately if currently on share section
            if (shareSection.classList.contains('active')) {
                 generateQRCodeForProfile(profile);
            }
        } catch (error) {
            console.error('Failed to save profile:', error);
            alert('Error saving profile.');
        }
    });

    // NFC Share Button
    shareNFCBtn.addEventListener('click', startNFCShare);

    // NFC Receive Button
    startNFCReceiveBtn.addEventListener('click', startNFCReceive);

    // Modal close button
    closeModalBtn.addEventListener('click', hideContactDetailsModal);
    window.addEventListener('click', (event) => {
        if (event.target == contactDetailsModal) {
            hideContactDetailsModal();
        }
    });

    // Modal Save to App Contacts Button
    saveToAppBtn.addEventListener('click', async () => {
        if (currentDisplayedContact) {
            try {
                await addReceivedContact(currentDisplayedContact);
                alert('Contact saved to your app contacts!');
                hideContactDetailsModal();
                renderReceivedContacts(); // Refresh the list
            } catch (error) {
                console.error('Failed to save received contact:', error);
                alert('Error saving contact to app.');
            }
        }
    });

    // Modal Export VCF Button
    exportVCFBtn.addEventListener('click', () => {
        if (currentDisplayedContact) {
            const vcf = generateVCard(currentDisplayedContact);
            const blob = new Blob([vcf], { type: 'text/vcard' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentDisplayedContact.fullName || 'contact'}.vcf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            alert('Contact exported as .vcf file!');
            hideContactDetailsModal();
        }
    });
});