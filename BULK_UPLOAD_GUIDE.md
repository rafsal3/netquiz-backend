# Implementing Bulk Question Upload in Admin Panel

This guide provides step-by-step instructions on how to build the frontend feature for drag-and-drop mass spreadsheet (Excel/CSV) uploading and mapping for your Admin Panel.

The backend endpoint `POST /api/questions/bulk` has been successfully created. It expects an array of mapped question objects.

## Dependencies

To handle Excel and CSV files via drag-and-drop on the frontend, you'll need the following familiar packages (if you are using React/Next.js):

```bash
# To parse Excel files
npm install xlsx

# (Optional) For easier drag and drop zones
npm install react-dropzone
```

## Step 1: Create the Drag & Drop Zone

Create a new component (e.g., `BulkUploadQuestions.tsx` or similar in your admin panel). 
Add a designated drop zone where admins can drag the `.xlsx` or `.csv` files.

When a file is dropped, you will use the `xlsx` library to parse the spreadsheet into a standard array of objects (where keys are column headers).

```typescript
import * as XLSX from 'xlsx';

// Inside your file drop handler
const handleFileUpload = (file: File) => {
  const reader = new FileReader();

  reader.onload = (e) => {
    const data = new Uint8Array(e.target?.result as ArrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });
    
    // Assume we are parsing the first sheet
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Parse to JSON array
    // Example: [{ "col1": "value", "col2": "value" }, ...]
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    // Retrieve column headers (from the first object)
    if (jsonData.length > 0) {
      const headers = Object.keys(jsonData[0]);
      setColumns(headers); // Set to state for the mapping dropdowns
      setRawData(jsonData); // Set raw parsed rows to state
    }
  };

  reader.readAsArrayBuffer(file);
};
```

## Step 2: Implement the Column Mapping UI

Once `columns` are loaded, you need to display dropdowns for the Admin to map the required question attributes to the file's columns.

Required fields you need to map:
- **Question Text**
- **Option A**
- **Option B**
- **Option C**
- **Option D**
- **Correct Answer** (Needs to map to A, B, C, or 1,2,3... our API will handle converting 0-3 to A-D)
- **Question Options (New)**: (Optional) A single column containing options like a, b, c, d (Intermediate options)
- **Explanation** (Optional)

In your JSX, you could render standard `<select>` inputs pointing to the `columns` options:

```jsx
// Simplified example
<select onChange={(e) => setMap({...map, questionText: e.target.value})}>
  <option value="">Select Column for Question Text</option>
  {columns.map(col => <option key={col} value={col}>{col}</option>)}
</select>
```

## Step 3: Global Metadata Selection (Category, Module)

Include your existing Paper, Module, and SubModule `<select>` dropdowns so the user can easily assign *all* the mapped questions to a specific category at once.

```javascript
const [selectedPaper, setSelectedPaper] = useState('');
const [selectedModule, setSelectedModule] = useState('');
const [selectedSubModule, setSelectedSubModule] = useState('');
```

## Step 4: Preview Table (Optional but Recommended)

Show a table previewing what the questions will look like after mapping.
You can include a checkbox next to each row allowing the Admin to deselect specific rows they don't want to upload right now.

## Step 5: Send Request to the `POST /api/questions/bulk` Endpoint

Once the mapping is done, iterate over `rawData` (or the selected rows), transforming each mapped row into the structure expected by the `POST /api/questions/bulk` endpoint.

```typescript
const handleUpload = async () => {
    // 1. Map raw objects into the format the backend expects
    const formattedQuestions = rawData.map(row => {
        return {
            paperId: selectedPaper, // ID of Paper from your category dropdown
            moduleId: selectedModule || undefined,
            subModuleId: selectedSubModule || undefined,
            
            // Map the parsed keys to the proper format
            text: row[map.questionText],
            options: {
                A: row[map.optionA]?.toString() || '',
                B: row[map.optionB]?.toString() || '',
                C: row[map.optionC]?.toString() || '',
                D: row[map.optionD]?.toString() || '',
            },
            correct: row[map.correctAnswer], // Validates on backend
            questionOptions: row[map.questionOptions] || '',
            explanation: row[map.explanation] || ''
        };
    });

    // 2. Make the API Call
    try {
        const response = await fetch(`${API_URL}/api/questions/bulk`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Ensure your token is passed
            },
            body: JSON.stringify({ questions: formattedQuestions })
        });
        
        const data = await response.json();
        if (response.ok) {
            alert(`Successfully uploaded ${data.count} questions!`);
            // Reset state & refresh questions table
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (e) {
        console.error('Upload error', e);
    }
};
```

### Note on "Correct Answer" Field Structure:
The backend `bulk` API accommodates flexible "correct answer" formats. 
If the Excel correct column resolves as numeric `0`, `1`, `2`, or `3`, it'll cast them to `"A"`, `"B"`, `"C"`, `"D"` respectively safely. Alternatively, passing actual "A", "B", "C", "D" letters directly works too!
