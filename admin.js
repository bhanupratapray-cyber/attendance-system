// --- 1. Database Initialization ---
// These are default fallbacks just in case the memory is completely empty
const defaultTeachers = { "T-01": "1234", "T-02": "5678" };
const defaultStudents = {
    "B-Pharm Sem 1": [
        { name: "Aarav Gupta", enrollment: "0706py261001" },
        { name: "Pooja Sharma", enrollment: "0706py261002" }
    ],
    "B-Pharm Sem 2": [
        { name: "Amit Sharma", enrollment: "0706py251001" },
        { name: "Priya Patel", enrollment: "0706py251002" },
        { name: "Rahul Verma", enrollment: "0706py251003" }
    ]
};

// Open the memory vaults. If they don't exist yet, use the defaults.
let adminTeacherDB = JSON.parse(localStorage.getItem('teacherVault')) || defaultTeachers;
let adminStudentDB = JSON.parse(localStorage.getItem('studentVault')) || defaultStudents;

// Save them immediately so they are officially locked in the vault
localStorage.setItem('teacherVault', JSON.stringify(adminTeacherDB));
localStorage.setItem('studentVault', JSON.stringify(adminStudentDB));

// --- 2. Teacher Management Logic ---
function renderTeachers() {
    const list = document.getElementById('teacher-list');
    list.innerHTML = ''; // Clear the current list
    
    // Loop through the vault and display every teacher
    for (let id in adminTeacherDB) {
        const li = document.createElement('li');
        li.innerHTML = `<span><strong>${id}</strong> (PIN: Saved)</span> 
                        <button class="btn-danger" onclick="deleteTeacher('${id}')">Remove</button>`;
        list.appendChild(li);
    }
}

// Add a Teacher
document.getElementById('btn-add-teacher').addEventListener('click', () => {
    const id = document.getElementById('new-teacher-id').value.trim().toUpperCase();
    const pin = document.getElementById('new-teacher-pin').value.trim();

    if (id && pin) {
        adminTeacherDB[id] = pin; // Add to database
        localStorage.setItem('teacherVault', JSON.stringify(adminTeacherDB)); // Save to memory
        renderTeachers(); // Refresh the screen
        
        // Clear the boxes
        document.getElementById('new-teacher-id').value = '';
        document.getElementById('new-teacher-pin').value = '';
        alert(`Teacher ${id} added successfully!`);
    } else {
        alert("Please enter both an ID and a PIN.");
    }
});

// Delete a Teacher
window.deleteTeacher = function(id) {
    if (confirm(`Are you sure you want to remove Teacher ${id}?`)) {
        delete adminTeacherDB[id];
        localStorage.setItem('teacherVault', JSON.stringify(adminTeacherDB));
        renderTeachers();
    }
};

// --- 3. Add Single Student Logic ---
document.getElementById('btn-add-student').addEventListener('click', () => {
    const batch = document.getElementById('admin-batch-select').value;
    const name = document.getElementById('new-student-name').value.trim();
    const enrollment = document.getElementById('new-student-enrollment').value.trim();

    if (name && enrollment) {
        // If the batch doesn't exist yet, create it
        if (!adminStudentDB[batch]) adminStudentDB[batch] = [];
        
        // Add the student
        adminStudentDB[batch].push({ name: name, enrollment: enrollment });
        localStorage.setItem('studentVault', JSON.stringify(adminStudentDB));
        
        alert(`${name} added to ${batch}!`);
        document.getElementById('new-student-name').value = '';
        document.getElementById('new-student-enrollment').value = '';
    } else {
        alert("Please enter the student's Name and Enrollment Number.");
    }
});

// --- 4. Bulk CSV Upload Logic ---
document.getElementById('btn-process-csv').addEventListener('click', () => {
    const batch = document.getElementById('csv-batch-select').value;
    const fileInput = document.getElementById('csv-upload');
    const file = fileInput.files[0];

    if (!file) { alert("Please select a CSV file first."); return; }

    const reader = new FileReader();
    
    // When the file is done reading:
    reader.onload = function(event) {
        const text = event.target.result;
        const rows = text.split('\n'); // Split by line
        let newStudents = [];

        // Loop through the rows (starting at 1 to skip the header row)
        for (let i = 1; i < rows.length; i++) {
            const columns = rows[i].split(',');
            if (columns.length >= 2) {
                const name = columns[0].trim();
                const enrollment = columns[1].trim();
                
                // If both exist, add them to our temporary list
                if (name && enrollment) {
                    newStudents.push({ name: name, enrollment: enrollment });
                }
            }
        }

        if (newStudents.length > 0) {
            // Overwrite the batch with the new master list
            adminStudentDB[batch] = newStudents; 
            localStorage.setItem('studentVault', JSON.stringify(adminStudentDB));
            alert(`Success! Imported ${newStudents.length} students into ${batch}.`);
            fileInput.value = ''; // Reset the file upload
        } else {
            alert("No valid data found in CSV. Make sure Column A is Name and Column B is Enrollment No.");
        }
    };
    
    reader.readAsText(file); // Start reading the file
});

// Boot up
renderTeachers();