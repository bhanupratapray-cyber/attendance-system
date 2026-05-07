// ==========================================
// --- 1. THE DATABASE & SETTINGS ---
// ==========================================
const GOOGLE_APP_URL = "https://script.google.com/macros/s/AKfycbx5v7obRt9h1iaom1av34ZmF6C2CIhNZTSC4NqfTXhTum3aEfku5ee5J04bCIGy1g/exec";

// We only need the student database now; Security Guard handles teachers!
const studentDatabase = JSON.parse(localStorage.getItem('studentVault')) || {};

let currentBatchList = []; 
let attendanceRecord = []; 
let currentIndex = 0;      
let sessionData = {};      

// Grab the active teacher from the new Admin Vault system
const activeSession = JSON.parse(localStorage.getItem('activeTeacherSession'));
if (activeSession) {
    sessionData.teacherId = activeSession.id;
}

// ==========================================
// --- 2. GRABBING ELEMENTS ---
// ==========================================
const setupScreen = document.getElementById('setup-screen');
const attendanceScreen = document.getElementById('attendance-screen');

const datePicker = document.getElementById('date-picker');
const batchSelect = document.getElementById('batch-select');
const btnStart = document.getElementById('btn-start');
const syncBanner = document.getElementById('sync-banner');
const syncText = document.getElementById('sync-text');
const btnSync = document.getElementById('btn-sync');

const classTitle = document.getElementById('class-title');
const dateDisplay = document.getElementById('date-display');
const flashcard = document.getElementById('flashcard');
const serialDisplay = document.getElementById('serial-number'); 
const nameDisplay = document.getElementById('student-name');
const enrollmentDisplay = document.getElementById('enrollment-number');
const statusDisplay = document.getElementById('status-indicator');
const btnHome = document.getElementById('btn-home'); 

const btnPrevious = document.getElementById('btn-previous');
const btnLeave = document.getElementById('btn-leave');
const btnNext = document.getElementById('btn-next');

const rapidInput = document.getElementById('rapid-roll-input'); 
const btnRapidPresent = document.getElementById('btn-rapid-present');
const btnShowMap = document.getElementById('btn-show-map');
const reviewScreen = document.getElementById('review-screen');
const attendanceMap = document.getElementById('attendance-map');
const attendanceList = document.getElementById('attendance-list');
const btnToggleView = document.getElementById('btn-toggle-view');
const btnToggleEdit = document.getElementById('btn-toggle-edit');
const reviewStatusText = document.getElementById('review-status-text');
const btnFinalSave = document.getElementById('btn-final-save');

let isEditMode = false;
let isListView = false; 

// ==========================================
// --- 3. SYNC LOGIC ---
// ==========================================
function updateSyncStatus() {
    let waitingRoom = JSON.parse(localStorage.getItem('offlineAttendanceVault')) || [];
    
    if (!syncBanner || !syncText || !btnSync) return; 

    if (waitingRoom.length > 0) {
        syncBanner.className = 'sync-pending';
        syncText.innerText = `⚠️ ${waitingRoom.length} Class(es) Pending`;
        btnSync.classList.remove('hidden');
    } else {
        syncBanner.className = 'sync-clear';
        syncText.innerText = `☁️ All data synced`;
        btnSync.classList.add('hidden');
    }
}

btnSync.addEventListener('click', async () => {
    let waitingRoom = JSON.parse(localStorage.getItem('offlineAttendanceVault')) || [];
    if (waitingRoom.length === 0) return;

    btnSync.innerText = "Syncing...";
    btnSync.disabled = true;

    try {
        for (let i = 0; i < waitingRoom.length; i++) {
            const payload = waitingRoom[i];
            await fetch(GOOGLE_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
                body: JSON.stringify(payload)
            });
        }
        
        // --- NEW: UPDATE THE AUDIT LOG STATUS ---
       let logVault = JSON.parse(localStorage.getItem('attendanceAuditLog')) || [];
        
        waitingRoom.forEach(payload => {
            // Find all pending entries for this batch and date and flip them to Submitted
            logVault.forEach(entry => {
                if (entry.batch === payload.batch && 
                    entry.date === payload.date && 
                    entry.status.includes('Pending')) {
                    entry.status = "✅ Submitted";
                }
            });
        });
        
        localStorage.setItem('attendanceAuditLog', JSON.stringify(logVault));
        // ----------------------------------------

        alert("Upload Successful! Data is now in your Google Sheet.");
        localStorage.removeItem('offlineAttendanceVault'); 
        updateSyncStatus(); 

    } catch (error) {
        alert("Sync failed. Check your internet connection.");
        console.error(error);
    } finally {
        btnSync.innerText = "Sync Now";
        btnSync.disabled = false;
    }
});

updateSyncStatus(); // Run once on load

// ==========================================
// --- 4. SETUP SCREEN LOGIC ---
// ==========================================
btnStart.addEventListener('click', () => {
    sessionData.date = datePicker.value;
    sessionData.batch = batchSelect.value;
    
    // Load students from the vault based on selected batch
    currentBatchList = studentDatabase[sessionData.batch] || [];
    
    classTitle.innerText = sessionData.batch;
    dateDisplay.innerText = sessionData.date;

    setupScreen.classList.add('hidden');
    attendanceScreen.classList.remove('hidden');

    loadStudent();
});

// ==========================================
// --- 5. THE CORE ENGINE (FLASHCARDS) ---
// ==========================================
function loadStudent() {
    if (currentBatchList.length === 0) {
        nameDisplay.innerText = "No Students Found";
        enrollmentDisplay.innerText = "Please upload CSV in Admin Panel";
        serialDisplay.innerText = "--";
        return;
    }
    
    const student = currentBatchList[currentIndex];
    const enrollStr = student.enrollment.toUpperCase();
    
    let rollNumber = "N/A";
    let admissionYear = "N/A";
    if (enrollStr.length >= 12) {
        const yearDigits = enrollStr.substring(6, 8); 
        admissionYear = "20" + yearDigits; 
        const serialDigits = enrollStr.substring(8, 12); 
        rollNumber = parseInt(serialDigits) - 1000; 
    }

    serialDisplay.innerText = `${rollNumber} (Batch: ${admissionYear})`;
    nameDisplay.innerText = student.name;
    enrollmentDisplay.innerText = student.enrollment; 

    const savedRecord = attendanceRecord[currentIndex];
    const savedStatus = savedRecord ? savedRecord.status.toLowerCase() : null;

    flashcard.className = ''; 
    
    if (savedStatus === 'present') {
        flashcard.classList.add('card-present');
        statusDisplay.innerText = 'Present';
    } else if (savedStatus === 'leave') {
        flashcard.classList.add('card-leave');
        statusDisplay.innerText = 'Leave';
    } else {
        flashcard.classList.add('card-default');
        statusDisplay.innerText = 'Absent';
    }
}

// ==========================================
// --- 6. RAPID ENTRY LOGIC ---
// ==========================================
function markRapidPresent() {
    const rawInput = rapidInput.value.trim();
    if (!rawInput) return;

    const rollNumbersToFind = rawInput.split(/[\s,]+/).map(num => parseInt(num)).filter(num => !isNaN(num));
    if (rollNumbersToFind.length === 0) return;

    let markedCount = 0;
    let notFound = [];

    for (let targetRoll of rollNumbersToFind) {
        let foundIndex = -1;

        for (let i = 0; i < currentBatchList.length; i++) {
            const enrollStr = currentBatchList[i].enrollment.toUpperCase();
            if (enrollStr.length >= 12) {
                const serialDigits = enrollStr.substring(8, 12);
                const rollNumber = parseInt(serialDigits) - 1000;
                if (rollNumber === targetRoll) {
                    foundIndex = i;
                    break;
                }
            }
        }

        if (foundIndex !== -1) {
            attendanceRecord[foundIndex] = {
                name: currentBatchList[foundIndex].name,
                enrollment: currentBatchList[foundIndex].enrollment,
                status: 'Present'
            };
            markedCount++;
        } else {
            notFound.push(targetRoll);
        }
    }

    rapidInput.value = ''; 
    if (notFound.length > 0 && markedCount > 0) {
        rapidInput.placeholder = `✅ ${markedCount} Marked. Not found: ${notFound.join(', ')}`;
    } else if (markedCount > 0) {
        rapidInput.placeholder = `✅ ${markedCount} Students Marked!`;
    } else {
        rapidInput.placeholder = `❌ No valid numbers found.`;
    }
    
    setTimeout(() => { rapidInput.placeholder = "e.g. 1 4 5 12"; }, 3000);

    loadStudent();
    rapidInput.focus(); 
}

btnRapidPresent.addEventListener('click', markRapidPresent);
rapidInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') markRapidPresent();
});

// ==========================================
// --- 7. UI INTERACTIONS ---
// ==========================================
flashcard.addEventListener('click', () => {
    if (flashcard.classList.contains('card-present')) {
        flashcard.className = 'card-default';
        statusDisplay.innerText = 'Absent';
    } else {
        flashcard.className = 'card-present';
        statusDisplay.innerText = 'Present';
    }
});

btnLeave.addEventListener('click', () => {
    flashcard.className = 'card-leave';
    statusDisplay.innerText = 'Leave';
});

btnNext.addEventListener('click', () => {
    if (!attendanceRecord[currentIndex]) {
        attendanceRecord[currentIndex] = {
            name: currentBatchList[currentIndex].name,
            enrollment: currentBatchList[currentIndex].enrollment,
            status: statusDisplay.innerText
        };
    } else {
        attendanceRecord[currentIndex].status = statusDisplay.innerText;
    }

    if (currentIndex < currentBatchList.length - 1) {
        currentIndex++;
        loadStudent();
    } else {
        attendanceScreen.classList.add('hidden');
        reviewScreen.classList.remove('hidden');
        renderReview();
    }
}); 

btnHome.addEventListener('click', () => {
    const confirmExit = confirm("Are you sure you want to go back? Any unsaved attendance will be lost.");
    if (confirmExit) {
        attendanceRecord = [];
        currentIndex = 0;
        attendanceScreen.classList.add('hidden');
        setupScreen.classList.remove('hidden');
    }
});

btnPrevious.addEventListener('click', () => {
    if (!attendanceRecord[currentIndex]) {
        attendanceRecord[currentIndex] = {
            name: currentBatchList[currentIndex].name,
            enrollment: currentBatchList[currentIndex].enrollment,
            status: statusDisplay.innerText
        };
    } else {
        attendanceRecord[currentIndex].status = statusDisplay.innerText;
    }

    if (currentIndex > 0) { 
        currentIndex--;   
        loadStudent();    
    }
});

// ==========================================
// --- 8. REVIEW MAP & LIST LOGIC ---
// ==========================================
function renderReview() {
    attendanceMap.innerHTML = '';
    attendanceList.innerHTML = '';

    currentBatchList.forEach((student, index) => {
        const record = attendanceRecord[index];
        const status = record ? record.status.toUpperCase() : 'ABSENT'; 
        
        const box = document.createElement('div');
        box.classList.add('map-box');
        if (status === 'PRESENT') box.classList.add('map-present');
        else if (status === 'LEAVE') box.classList.add('map-leave');
        else box.classList.add('map-absent');
        
        box.innerText = index + 1; 

        const listItem = document.createElement('div');
        listItem.classList.add('list-item');
        
        let statusColor = status === 'PRESENT' ? 'green' : (status === 'LEAVE' ? '#d39e00' : 'red');
        listItem.innerHTML = `<span>${index + 1}. ${student.name}</span> <span style="color: ${statusColor};">${status}</span>`;

        const jumpToStudent = () => {
            if (!isEditMode) return; 
            
            currentIndex = index;
            loadStudent(); 
            
            reviewScreen.classList.add('hidden');
            attendanceScreen.classList.remove('hidden');
            
            toggleEditMode(false); 
        };

        box.addEventListener('click', jumpToStudent);
        listItem.addEventListener('click', jumpToStudent);

        attendanceMap.appendChild(box);
        attendanceList.appendChild(listItem);
    });
}

function toggleEditMode(forceState) {
    isEditMode = forceState !== undefined ? forceState : !isEditMode;
    
    if (isEditMode) {
        btnToggleEdit.innerText = "Lock Edit Mode";
        btnToggleEdit.style.background = "#dc3545"; 
        btnToggleEdit.style.color = "white";
        reviewStatusText.innerText = "✏️ Edit Mode (Tap a student to edit)";
        reviewStatusText.style.color = "#dc3545";
        attendanceMap.classList.add('edit-mode-active');
        attendanceList.classList.add('edit-mode-active');
    } else {
        btnToggleEdit.innerText = "Unlock Edit Mode";
        btnToggleEdit.style.background = "#ffc107"; 
        btnToggleEdit.style.color = "#333";
        reviewStatusText.innerText = "🔒 Review Mode (Locked)";
        reviewStatusText.style.color = "#666";
        attendanceMap.classList.remove('edit-mode-active');
        attendanceList.classList.remove('edit-mode-active');
    }
}

btnToggleView.addEventListener('click', () => {
    isListView = !isListView;
    if (isListView) {
        attendanceMap.classList.add('hidden');
        attendanceList.classList.remove('hidden');
        btnToggleView.innerText = "Show Map";
    } else {
        attendanceMap.classList.remove('hidden');
        attendanceList.classList.add('hidden');
        btnToggleView.innerText = "Show List";
    }
});

btnToggleEdit.addEventListener('click', () => toggleEditMode());

btnShowMap.addEventListener('click', () => {
    if (!attendanceRecord[currentIndex]) {
        attendanceRecord[currentIndex] = {
            name: currentBatchList[currentIndex].name,
            enrollment: currentBatchList[currentIndex].enrollment,
            status: statusDisplay.innerText
        };
    } else {
        attendanceRecord[currentIndex].status = statusDisplay.innerText;
    }

    attendanceScreen.classList.add('hidden');
    reviewScreen.classList.remove('hidden');
    renderReview();
});

// ==========================================
// --- 9. FINAL SUBMIT TO VAULT ---
// ==========================================
btnFinalSave.addEventListener('click', () => {
    btnFinalSave.innerText = "Saving... Please wait";
    btnFinalSave.style.background = "#6c757d"; 
    btnFinalSave.disabled = true;

    for (let i = 0; i < currentBatchList.length; i++) {
        if (!attendanceRecord[i]) {
            attendanceRecord[i] = {
                name: currentBatchList[i].name,
                enrollment: currentBatchList[i].enrollment,
                status: 'ABSENT'
            };
        } else {
            attendanceRecord[i].status = attendanceRecord[i].status.toUpperCase();
        }
    }

    const finalData = {
        teacherId: sessionData.teacherId, 
        date: sessionData.date,
        batch: sessionData.batch,
        records: attendanceRecord,
        timestamp: new Date().getTime()
    };

    fetch(GOOGLE_APP_URL, {
        method: 'POST',
        body: JSON.stringify(finalData),
        headers: {
            'Content-Type': 'text/plain;charset=utf-8' 
        }
    })
    .then(response => response.json())
    .then(data => {
        if(data.status === 'success') {
            alert("Attendance successfully saved directly to the Google Sheet!");
            addToAuditLog(sessionData.batch, sessionData.teacherId, "✅ Submitted");
            resetToSetup();
        } else {
            alert("Attendance saved to local vault");
            saveOffline(finalData);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert("Attendance saved to local vault");
        saveOffline(finalData); 
    });
});

function saveOffline(dataPackage) {
    let waitingRoom = JSON.parse(localStorage.getItem('offlineAttendanceVault')) || [];
    waitingRoom.push(dataPackage);
    localStorage.setItem('offlineAttendanceVault', JSON.stringify(waitingRoom));
    addToAuditLog(dataPackage.batch, dataPackage.teacherId, "❌ Pending");
    
    updateSyncStatus();
    resetToSetup();
}

function resetToSetup() {
    reviewScreen.classList.add('hidden');
    setupScreen.classList.remove('hidden');
    
    btnFinalSave.innerText = "Submit to Vault";
    btnFinalSave.style.background = "#28a745";
    btnFinalSave.disabled = false;
    
    attendanceRecord = [];
    currentIndex = 0;
}
// --- NEW: LOG GENERATOR ---
function addToAuditLog(batch, teacher, status) {
    let logVault = JSON.parse(localStorage.getItem('attendanceAuditLog')) || [];
    
    // Use the exact same date format as the class (YYYY-MM-DD)
    const logDate = sessionData.date || new Date().toISOString().split('T')[0];

    const newEntry = {
        batch: batch,
        teacher: teacher,
        status: status,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: logDate 
    };

    logVault.unshift(newEntry);
    if (logVault.length > 50) logVault.pop();
    localStorage.setItem('attendanceAuditLog', JSON.stringify(logVault));
}