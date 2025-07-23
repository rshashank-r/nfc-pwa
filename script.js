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


// --- PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    });
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
    if (profile.linkedin) vcard += `X-SOCIALPROFILE;type=linkedin:${profile.linkedin}\n`; // Custom field for LinkedIn
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
        else if (line.startsWith('X-SOCIALPROFILE;type=linkedin:')) contact.linkedin = line.substring('X-SOCIALPROFILE;type=linkedin:'.length).trim();
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
        displayFullName.textContent = 'N/A'; // ... and so on for others
    }
}

async function renderReceivedContacts() {
    const contacts = await getReceivedContacts();
    contactListUl.innerHTML = ''; // Clear previous list
    if (contacts && contacts.length > 0) {
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
    if (!profile || !profile.fullName) { // QR requires at least a name
        qrcodeDiv.innerHTML = '<p>Save your profile first to generate QR code.</p>';
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
        nfcStatus.textContent = 'Error: Please save your profile first!';
        nfcStatus.style.color = 'red';
        return;
    }

    const vcardString = generateVCard(profile);

    if ('NDEFReader' in window) {
        try {
            const reader = new NDEFReader();
            await reader.write({
                records: [{
                    recordType: "mime",
                    mediaType: "text/vcard",
                    data: new TextEncoder().encode(vcardString)
                }]
            });
            nfcStatus.textContent = 'Profile shared successfully via NFC!';
            nfcStatus.style.color = 'green';
        } catch (error) {
            console.error('NFC Write Error:', error);
            nfcStatus.textContent = `NFC Share Failed: ${error.message}. Ensure NFC is on and permissions granted.`;
            nfcStatus.style.color = 'red';
        }
    } else {
        nfcStatus.textContent = 'Web NFC API not supported in this browser/device.';
        nfcStatus.style.color = 'orange';
    }
}

async function startNFCReceive() {
    if (nfcReader && nfcReader.onreading) { // Check if already listening
        nfcReceiveStatus.textContent = 'Already listening for NFC contacts.';
        nfcReceiveStatus.style.color = 'orange';
        return;
    }

    nfcReceiveStatus.textContent = 'Listening for NFC contacts... Tap devices together.';
    nfcReceiveStatus.style.color = '#007bff';

    if ('NDEFReader' in window) {
        try {
            nfcReader = new NDEFReader();
            nfcReader.onreading = async event => {
                console.log('NFC data received:', event);
                nfcReceiveStatus.textContent = 'NFC contact received!';
                nfcReceiveStatus.style.color = 'green';

                for (const record of event.message.records) {
                    if (record.recordType === "mime" && record.mediaType === "text/vcard") {
                        const decoder = new TextDecoder();
                        const vcardString = decoder.decode(record.data);
                        console.log('Received vCard:', vcardString);
                        const receivedContact = parseVCard(vcardString);
                        showContactDetailsModal(receivedContact);
                        break; // Process first vCard found
                    }
                }
            };
            nfcReader.onreadingerror = error => {
                console.error('NFC Reading Error:', error);
                nfcReceiveStatus.textContent = `NFC Receive Error: ${error.message}`;
                nfcReceiveStatus.style.color = 'red';
            };
            await nfcReader.scan();
            nfcReceiveStatus.textContent = 'Listening for NFC contacts... Tap devices together.'; // Reset status
            nfcReceiveStatus.style.color = '#007bff';
        } catch (error) {
            console.error('NFC Scan Error:', error);
            nfcReceiveStatus.textContent = `Failed to start NFC scan: ${error.message}. Ensure NFC is on and permissions granted.`;
            nfcReceiveStatus.style.color = 'red';
            nfcReader = null; // Clear reader on error
        }
    } else {
        nfcReceiveStatus.textContent = 'Web NFC API not supported in this browser/device.';
        nfcReceiveStatus.style.color = 'orange';
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
    });
    navReceivedBtn.addEventListener('click', () => {
        showSection('receivedSection');
        renderReceivedContacts(); // Refresh list
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