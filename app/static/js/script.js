document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('upload-form');
    const fileInput = document.getElementById('pdf-files');
    const fileNames = document.getElementById('file-names');
    const submitBtn = document.getElementById('submit-btn');
    const clearBtn = document.getElementById('clear-files');
    const resultsSection = document.getElementById('results-section');
    const loadingContainer = document.querySelector('.loading-container');
    const loadingText = document.getElementById('loading-text');
    const resultsContent = document.getElementById('results-content');
    const toggleBtn = document.getElementById('toggle-upload-btn');
    const uploadContent = document.getElementById('upload-content');
    const uploadSection = document.querySelector('.upload-section');
    const openJsonLoaderBtn = document.getElementById('openJsonLoader');
    const modal = document.getElementById('jsonLoaderModal');
    const cancelBtn = document.getElementById('cancelJsonLoad');
    const loadBtn = document.getElementById('loadJson');
    const jsonInput = document.getElementById('jsonInput');
    
    console.log('Setting up JSON loader...');
    
    // Log if we found all elements
    console.log('Found elements:', {
        openJsonLoaderBtn: !!openJsonLoaderBtn,
        modal: !!modal,
        cancelBtn: !!cancelBtn,
        loadBtn: !!loadBtn,
        jsonInput: !!jsonInput
    });
    
    // Toggle upload section
    function toggleUploadSection() {
        uploadContent.classList.toggle('hidden');
        const icon = toggleBtn.querySelector('.toggle-icon');
        icon.textContent = uploadContent.classList.contains('hidden') ? '▼' : '▲';
    }
    
    toggleBtn.addEventListener('click', toggleUploadSection);
    
    // Selected files storage
    let selectedFiles = [];
    
    // Add status list to loading container
    const statusList = document.createElement('div');
    statusList.className = 'status-list';
    loadingContainer.appendChild(statusList);
    
    // Handle file selection
    fileInput.addEventListener('change', function(e) {
        const files = Array.from(e.target.files);
        
        // Add new files to our array
        files.forEach(file => {
            if (file.type === 'application/pdf') {
                selectedFiles.push(file);
            }
        });
        
        // Update the UI
        updateFileList();
    });
    
    // Handle clearing files
    clearBtn.addEventListener('click', async function() {
        // Clear the file input
        fileInput.value = '';
        
        // Clear selected files array
        selectedFiles = [];
        
        // Update UI
        updateFileList();
        
        // Hide results section
        resultsSection.style.display = 'none';
        resultsContent.innerHTML = '';
        
        // Clear uploaded files on the server
        try {
            const response = await fetch('/clear-uploads', {
                method: 'POST'
            });
            
            if (!response.ok) {
                console.error('Failed to clear uploaded files on server');
            }
        } catch (error) {
            console.error('Error clearing uploads:', error);
        }
    });
    
    // Update the file list in the UI
    function updateFileList() {
        fileNames.innerHTML = '';
        
        if (selectedFiles.length === 0) {
            fileNames.style.display = 'none';
            clearBtn.disabled = true;
            return;
        }
        
        fileNames.style.display = 'block';
        clearBtn.disabled = false;
        
        selectedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            const fileName = document.createElement('span');
            fileName.textContent = file.name;
            
            const removeBtn = document.createElement('span');
            removeBtn.className = 'remove-file';
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', function() {
                selectedFiles.splice(index, 1);
                updateFileList();
            });
            
            fileItem.appendChild(fileName);
            fileItem.appendChild(removeBtn);
            fileNames.appendChild(fileItem);
        });
        
        // Enable/disable submit button based on file selection
        submitBtn.disabled = selectedFiles.length === 0;
    }
    
    // Initialize clear button state
    clearBtn.disabled = true;
    
    // Debug log to check if form is found
    console.log('Form element found:', !!form);

    if (form) {
        // Handle form submission
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // ... existing file validation code ...

            try {
                // First, upload the files
                const uploadResponse = await uploadFiles(selectedFiles);
                console.log('Upload response:', uploadResponse);

                if (uploadResponse.error) {
                    throw new Error(uploadResponse.error);
                }

                // Then process them with the underwrite endpoint
                const provider = document.getElementById('provider').value;
                const debugMode = document.getElementById('debug').checked;
                
                const requestData = {
                    file_paths: uploadResponse.original_files,
                    merged_files: uploadResponse.merged_files,
                    provider: provider.toLowerCase(),
                    debug: debugMode
                };
                
                console.log('Sending underwrite request:', requestData);

                const response = await fetch('/underwrite', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestData)
                });

                if (!response.ok) {
                    throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();
                console.log('Underwrite response:', result);

                // Display results
                handleAnalysisResults(result);

            } catch (error) {
                console.error('Error during underwriting:', error);

                // Show error in results section
                resultsSection.classList.remove('hidden');
                resultsContent.innerHTML = `
                    <div class="error bg-red-50 border border-red-200 rounded-lg p-4">
                        <h3 class="text-red-800 font-semibold mb-2">Error</h3>
                        <p class="text-red-600">${error.message}</p>
                    </div>
                `;
            }
        });
    } else {
        console.error('Upload form not found!');
    }

    // Function to upload files
    async function uploadFiles(files) {
        const formData = new FormData();
        for (let file of files) {
            formData.append('files', file);
        }

        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }

        return response.json();
    }
    
    // Function to update status display
    function updateStatus(status) {
        const statusList = document.querySelector('.status-list');
        if (!statusList) return;

        // Try to find existing status item for this step
        let statusItem = Array.from(statusList.children).find(
            item => item.getAttribute('data-step') === status.step
        );
        
        // If no existing item, create new one
        if (!statusItem) {
            statusItem = document.createElement('div');
            statusItem.setAttribute('data-step', status.step);
            statusItem.className = 'flex items-center p-4 bg-white rounded-lg shadow-sm border border-gray-100 animate-fade-in';
            statusList.appendChild(statusItem);
        }
        
        // Determine status color and icon
        let statusColor = 'blue';
        let icon = '';
        
        switch(status.status.toLowerCase()) {
            case 'complete':
                statusColor = 'green';
                icon = `<svg class="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>`;
                break;
            case 'error':
                statusColor = 'red';
                icon = `<svg class="w-5 h-5 text-red-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>`;
                break;
            default:
                icon = `<svg class="w-5 h-5 text-blue-500 mr-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>`;
        }
        
        statusItem.innerHTML = `
            ${icon}
            <div class="flex-1">
                <div class="flex items-center justify-between">
                    <span class="font-medium text-gray-800">${status.step}</span>
                    <span class="text-sm text-${statusColor}-600 font-medium">${status.status}</span>
                </div>
                ${status.details ? `<p class="text-sm text-gray-600 mt-1">${status.details}</p>` : ''}
            </div>
        `;

        // Scroll to the bottom of the status list
        statusList.scrollTop = statusList.scrollHeight;
    }

    // Add tab functionality
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', handleTabClick);
    });

    // Initialize copy button if it exists
    initializeJsonCopy();

    // Open modal
    openJsonLoaderBtn.addEventListener('click', () => {
        console.log('Opening modal');
        modal.classList.remove('hidden');
    });

    // Close modal
    cancelBtn.addEventListener('click', () => {
        console.log('Canceling');
        modal.classList.add('hidden');
        jsonInput.value = '';
    });

    // Close modal if clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
            jsonInput.value = '';
        }
    });

    // Load JSON
    loadBtn.addEventListener('click', () => {
        console.log('Load button clicked');
        const inputValue = jsonInput.value;
        console.log('Input value:', inputValue);
        
        try {
            const jsonData = JSON.parse(inputValue);
            console.log('Parsed JSON:', jsonData);
            
            // Make sure results section is visible
            const resultsSection = document.getElementById('results-section');
            if (resultsSection) {
                resultsSection.classList.remove('hidden');
            }
            
            displayResults(jsonData);
            modal.classList.add('hidden');
            jsonInput.value = '';
        } catch (e) {
            console.error('JSON parse error:', e);
            alert('Invalid JSON format. Please check your input.');
        }
    });
});

// Define the initializeJsonCopy function
function initializeJsonCopy() {
    const copyButton = document.getElementById('copy-json');
    if (!copyButton) return;

    copyButton.addEventListener('click', async () => {
        // Get the pre element inside the raw-tab that contains the JSON
        const jsonContent = document.querySelector('#raw-tab pre');
        
        if (!jsonContent) {
            console.error('JSON content element not found');
            return;
        }
        
        try {
            // Get the text content and format it
            const jsonText = jsonContent.textContent;
            await navigator.clipboard.writeText(jsonText);
            
            // Update button to show success state
            const originalContent = copyButton.innerHTML;
            copyButton.innerHTML = `
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Copied!
            `;
            copyButton.classList.remove('bg-blue-50', 'text-blue-600');
            copyButton.classList.add('bg-green-50', 'text-green-600');
            
            // Reset button after 2 seconds
            setTimeout(() => {
                copyButton.innerHTML = `
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy JSON
                `;
                copyButton.classList.remove('bg-green-50', 'text-green-600');
                copyButton.classList.add('bg-blue-50', 'text-blue-600');
            }, 2000);
            
        } catch (err) {
            console.error('Failed to copy JSON:', err);
            
            // Show error state
            copyButton.innerHTML = `
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Failed to copy
            `;
            copyButton.classList.remove('bg-blue-50', 'text-blue-600');
            copyButton.classList.add('bg-red-50', 'text-red-600');
            
            // Reset button after 2 seconds
            setTimeout(() => {
                copyButton.innerHTML = `
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy JSON
                `;
                copyButton.classList.remove('bg-red-50', 'text-red-600');
                copyButton.classList.add('bg-blue-50', 'text-blue-600');
            }, 2000);
        }
    });
}

const ResultsState = {
    CONTINUITY_ERROR: 'CONTINUITY_ERROR',
    SUCCESS: 'SUCCESS',
    ERROR: 'ERROR'
};

function determineResultsState(response) {
    if (!response) return ResultsState.ERROR;
    
    const continuityAnalysis = safeAccess(response, 'metrics.statement_continuity.analysis');
    if (continuityAnalysis && !continuityAnalysis.is_contiguous) {
        return ResultsState.CONTINUITY_ERROR;
    }
    
    return ResultsState.SUCCESS;
}

function displayResults(response) {
    console.log('Response received:', response);

    const resultsSection = document.getElementById('results-section');
    if (!resultsSection) {
        console.error('Results section not found');
        return;
    }

    // Make sure results section is visible
    resultsSection.classList.remove('hidden');

    // Update Summary tab
    const summaryTab = document.getElementById('summary-tab');
    if (summaryTab) {
        const recommendations = safeAccess(response, 'loan_recommendations', []);
        const termLoanRec = recommendations.find(rec => rec.product_type === 'term_loan') || {};
        const accountsPayableRec = recommendations.find(rec => rec.product_type === 'accounts_payable') || {};

        summaryTab.innerHTML = `
            <div class="space-y-6">
                <!-- Term Loan Summary Card -->
                <div class="bg-white shadow rounded-lg p-6">
                    <div class="flex items-center justify-between mb-6">
                        <h2 class="text-xl font-bold text-gray-900">Term Loan</h2>
                        <span class="px-4 py-2 rounded-full text-sm font-semibold ${
                            termLoanRec?.approval_decision 
                            ? 'bg-green-100 text-green-800 border border-green-200' 
                            : 'bg-red-100 text-red-800 border border-red-200'
                        }">
                            ${termLoanRec?.approval_decision ? 'Approved' : 'Not Approved'}
                        </span>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div class="p-4 bg-gray-50 rounded-lg">
                            <h3 class="font-semibold mb-2">Maximum Loan Amount</h3>
                            <p class="text-2xl font-bold">$${formatNumber(termLoanRec?.max_loan_amount)}</p>
                        </div>
                        <div class="p-4 bg-gray-50 rounded-lg">
                            <h3 class="font-semibold mb-2">Monthly Payment</h3>
                            <p class="text-2xl font-bold">$${formatNumber(termLoanRec?.max_monthly_payment_amount)}</p>
                        </div>
                    </div>
                </div>

                <!-- Accounts Payable Summary Card -->
                <div class="bg-white shadow rounded-lg p-6">
                    <div class="flex items-center justify-between mb-6">
                        <h2 class="text-xl font-bold text-gray-900">Accounts Payable Financing</h2>
                        <span class="px-4 py-2 rounded-full text-sm font-semibold ${
                            accountsPayableRec?.approval_decision 
                            ? 'bg-green-100 text-green-800 border border-green-200' 
                            : 'bg-red-100 text-red-800 border border-red-200'
                        }">
                            ${accountsPayableRec?.approval_decision ? 'Approved' : 'Not Approved'}
                        </span>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div class="p-4 bg-gray-50 rounded-lg">
                            <h3 class="font-semibold mb-2">Maximum Financing Amount</h3>
                            <p class="text-2xl font-bold">$${formatNumber(accountsPayableRec?.max_loan_amount)}</p>
                        </div>
                        <div class="p-4 bg-gray-50 rounded-lg">
                            <h3 class="font-semibold mb-2">Maximum Draw Amount</h3>
                            <p class="text-2xl font-bold">$${formatNumber(accountsPayableRec?.max_monthly_payment_amount)}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Update Credit Decision tab
    const financialsTab = document.getElementById('financials-tab');
    if (financialsTab) {
        const recommendations = safeAccess(response, 'loan_recommendations', []);
        const termLoanRec = recommendations.find(rec => rec.product_type === 'term_loan');
        const accountsPayableRec = recommendations.find(rec => rec.product_type === 'accounts_payable');

        financialsTab.innerHTML = `
            <div class="space-y-8">
                <!-- Term Loan Section -->
                ${renderProductSection('Term Loan', termLoanRec)}

                <!-- Accounts Payable Section -->
                ${renderProductSection('Accounts Payable Financing', accountsPayableRec)}
            </div>
        `;
    }

    // Update other tabs...
    updateFinancialTab(response);
    
    // Update Raw JSON tab
    const rawTab = document.getElementById('raw-tab');
    if (rawTab) {
        rawTab.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-semibold text-gray-800">Raw JSON Data</h3>
                <button id="copy-json" class="flex items-center px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy JSON
                </button>
            </div>
            <pre class="bg-gray-100 rounded-lg p-4 font-mono text-sm overflow-x-auto whitespace-pre-wrap">${JSON.stringify(response, null, 2)}</pre>
        `;
        
        initializeJsonCopy();
    }
}

// Helper function for safe object access
function safeAccess(obj, path, defaultValue = null) {
    try {
        return path.split('.').reduce((acc, part) => acc?.[part], obj) ?? defaultValue;
    } catch (e) {
        console.warn(`Error accessing path ${path}:`, e);
        return defaultValue;
    }
}

// Helper function to format numbers
function formatNumber(num) {
    if (num === undefined || num === null) {
        return '0.00';
    }
    return num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}


// Tab initialization function
function initializeTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            tab.classList.add('active');
            
            // Hide all tab panes
            tabPanes.forEach(pane => pane.classList.add('hidden'));
            // Show the selected tab pane
            const targetPane = document.getElementById(`${tab.dataset.tab}-tab`);
            if (targetPane) {
                targetPane.classList.remove('hidden');
            }
        });
    });

    // Show summary tab by default
    const summaryTab = document.querySelector('[data-tab="summary"]');
    if (summaryTab) {
        summaryTab.click();
    }
}




// Add this CSS to your HTML file or update the existing loading container styles
document.addEventListener('DOMContentLoaded', function() {
    // ... existing code ...

    // Update loading container styles
    const loadingContainer = document.querySelector('.loading-container');
    loadingContainer.className = 'loading-container hidden bg-white rounded-lg shadow-md p-6 mb-8 max-w-2xl mx-auto';
    
    // Update status list styles
    const statusList = document.querySelector('.status-list');
    statusList.className = 'status-list space-y-2 mt-4 max-h-60 overflow-y-auto';
    
    // Add loading text styles
    const loadingText = document.getElementById('loading-text');
    loadingText.className = 'text-xl font-semibold text-gray-800 mb-4';
});

// Add this to your existing styles or in a <style> tag in your HTML
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes fade-in {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    .animate-fade-in {
        animation: fade-in 0.3s ease-out forwards;
    }
    
    .status-list::-webkit-scrollbar {
        width: 6px;
    }
    
    .status-list::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 3px;
    }
    
    .status-list::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 3px;
    }
    
    .status-list::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
    }
`;
document.head.appendChild(styleSheet);

// Add this function to handle tab clicks
function handleTabClick(e) {
    // Get all tab buttons and content panes
    const tabs = document.querySelectorAll('.tab-btn');
    const panes = document.querySelectorAll('.tab-pane');
    
    // Remove active classes from all tabs
    tabs.forEach(tab => {
        tab.classList.remove('active', 'text-blue-600', 'border-b-2', 'border-blue-600');
        tab.classList.add('text-gray-500');
    });
    
    // Hide all panes
    panes.forEach(pane => {
        pane.classList.add('hidden');
    });
    
    // Add active classes to clicked tab
    e.target.classList.add('active', 'text-blue-600', 'border-b-2', 'border-blue-600');
    e.target.classList.remove('text-gray-500');
    
    // Show corresponding pane
    const tabId = e.target.getAttribute('data-tab');
    const pane = document.getElementById(`${tabId}-tab`);
    if (pane) {
        pane.classList.remove('hidden');
    }
}

// Update Financial Analysis tab with safety checks
function updateFinancialsTab(response) {
    const financialsTab = document.getElementById('financials-tab');
    if (!financialsTab) return;

    const recommendations = safeAccess(response, 'loan_recommendations', []);
    
    // Find recommendations for each product
    const termLoanRec = recommendations.find(rec => rec.product_type === 'term_loan') || {};
    const accountsPayableRec = recommendations.find(rec => rec.product_type === 'accounts_payable') || {};

    // Update Term Loan section
    updateProductSection('term-loan', termLoanRec);
    
    // Update Accounts Payable section
    updateProductSection('accounts-payable', accountsPayableRec);
}

// Add new helper function to render each product section
function updateProductSection(sectionId, recommendation) {
    const statusDiv = document.getElementById(`${sectionId}-status`);
    const contentDiv = document.getElementById(`${sectionId}-content`);
    
    if (!statusDiv || !contentDiv) return;

    // Update status pill
    statusDiv.innerHTML = `
        <span class="px-4 py-1 rounded-full text-sm font-semibold ${
            recommendation.approval_decision 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : 'bg-red-100 text-red-800 border border-red-200'
        }">
            ${recommendation.approval_decision ? 'Approved' : 'Not Approved'}
        </span>
    `;

    // Update content
    contentDiv.innerHTML = `
        <div class="space-y-6">
            <!-- Loan Details -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-gray-50 rounded-lg p-4">
                    <p class="text-sm text-gray-600">Maximum Amount</p>
                    <p class="text-lg font-semibold">$${formatNumber(recommendation.max_loan_amount || 0)}</p>
                </div>
                <div class="bg-gray-50 rounded-lg p-4">
                    <p class="text-sm text-gray-600">Monthly Payment</p>
                    <p class="text-lg font-semibold">$${formatNumber(recommendation.max_monthly_payment_amount || 0)}</p>
                </div>
                <div class="bg-gray-50 rounded-lg p-4">
                    <p class="text-sm text-gray-600">Confidence Score</p>
                    <p class="text-lg font-semibold">${((recommendation.confidence_score || 0) * 100).toFixed(1)}%</p>
                </div>
            </div>

            <!-- Analysis Details -->
            <div class="mt-6">
                <h4 class="font-semibold text-gray-700 mb-2">Analysis</h4>
                <p class="text-gray-600">${recommendation.detailed_analysis || 'No detailed analysis available.'}</p>
            </div>

            <!-- Factors Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <!-- Risk Factors -->
                <div>
                    <h4 class="font-semibold text-gray-700 mb-2">Risk Factors</h4>
                    <ul class="list-disc pl-5 space-y-1">
                        ${(recommendation.risk_factors || [])
                            .map(factor => `<li class="text-red-600">${factor}</li>`)
                            .join('') || '<li class="text-gray-500">No risk factors identified</li>'}
                    </ul>
                </div>

                <!-- Mitigating Factors -->
                <div>
                    <h4 class="font-semibold text-gray-700 mb-2">Mitigating Factors</h4>
                    <ul class="list-disc pl-5 space-y-1">
                        ${(recommendation.mitigating_factors || [])
                            .map(factor => `<li class="text-green-600">${factor}</li>`)
                            .join('') || '<li class="text-gray-500">No mitigating factors identified</li>'}
                    </ul>
                </div>
            </div>

            <!-- Conditions if Approved -->
            <div class="mt-6">
                <h4 class="font-semibold text-gray-700 mb-2">Conditions if Approved</h4>
                <ul class="list-disc pl-5 space-y-1">
                    ${(recommendation.conditions_if_approved || [])
                        .map(condition => `<li class="text-gray-600">${condition}</li>`)
                        .join('') || '<li class="text-gray-500">No conditions specified</li>'}
                </ul>
            </div>

            <!-- Key Metrics -->
            <div class="mt-6">
                <h4 class="font-semibold text-gray-700 mb-2">Key Metrics</h4>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="bg-gray-50 rounded-lg p-3">
                        <p class="text-xs text-gray-500">Payment Coverage</p>
                        <p class="text-sm font-semibold">${(safeAccess(recommendation, 'key_metrics.payment_coverage_ratio', 0)).toFixed(2)}</p>
                    </div>
                    <div class="bg-gray-50 rounded-lg p-3">
                        <p class="text-xs text-gray-500">Balance Trend</p>
                        <p class="text-sm font-semibold capitalize">${safeAccess(recommendation, 'key_metrics.average_daily_balance_trend', 'N/A')}</p>
                    </div>
                    <div class="bg-gray-50 rounded-lg p-3">
                        <p class="text-xs text-gray-500">Lowest Monthly Balance</p>
                        <p class="text-sm font-semibold">$${formatNumber(safeAccess(recommendation, 'key_metrics.lowest_monthly_balance', 0))}</p>
                    </div>
                    <div class="bg-gray-50 rounded-lg p-3">
                        <p class="text-xs text-gray-500">Highest NSF Count</p>
                        <p class="text-sm font-semibold">${safeAccess(recommendation, 'key_metrics.highest_nsf_month_count', 0)}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Update Financial Summary tab with safety checks
function updateFinancialTab(response) {
    const financialTab = document.getElementById('financial-tab');
    if (!financialTab) return;

    const dailyBalances = safeAccess(response, 'metrics.daily_balances.daily_balances', []);
    const monthlyBalances = safeAccess(response, 'metrics.closing_balances.monthly_closing_balances', []);
    const monthlyFinancialsData = safeAccess(response, 'metrics.monthly_financials.monthly_data', {});
    const statistics = safeAccess(response, 'metrics.monthly_financials.statistics', {});

    // Create Daily Balance Chart
    const chartCanvas = document.getElementById('dailyBalanceChart');
    if (chartCanvas?.getContext && dailyBalances.length > 0) {
        const ctx = chartCanvas.getContext('2d');
        try {
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dailyBalances.map(item => item.date),
                    datasets: [{
                        label: 'Daily Balance',
                        data: dailyBalances.map(item => item.balance),
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `Balance: $${formatNumber(context.raw || 0)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return '$' + formatNumber(value);
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating chart:', error);
            chartCanvas.parentElement.innerHTML = '<div class="p-4 text-gray-600">Error creating chart</div>';
        }
    }

    // Update Monthly Balance Table
    const monthlyBalanceTable = document.getElementById('monthlyBalanceTable');
    if (monthlyBalanceTable) {
        monthlyBalanceTable.innerHTML = `
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Closing Balance</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Verification</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${monthlyBalances.length > 0 ? monthlyBalances.map(balance => `
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${balance.month || 'N/A'}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">$${formatNumber(balance.balance || 0)}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${balance.verification || 'Unverified'}</td>
                            </tr>
                        `).join('') : `
                            <tr>
                                <td colspan="3" class="px-6 py-4 text-center text-gray-500">No monthly balance data available</td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>
        `;
    }

    // Update Monthly Cash Flow Summary
    const monthlyCashFlow = document.getElementById('monthlyCashFlow');
    if (monthlyCashFlow) {
        monthlyCashFlow.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Monthly Data Table -->
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Expenses</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cash Flow</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${Object.entries(monthlyFinancialsData).length > 0 ? 
                                Object.entries(monthlyFinancialsData).map(([month, data]) => `
                                    <tr>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${month}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">$${formatNumber(data.revenue || 0)}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">$${formatNumber(data.expenses || 0)}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-right ${(data.cashflow || 0) >= 0 ? 'text-green-600' : 'text-red-600'}">
                                            $${formatNumber(data.cashflow || 0)}
                                        </td>
                                    </tr>
                                `).join('') : `
                                    <tr>
                                        <td colspan="4" class="px-6 py-4 text-center text-gray-500">No monthly financial data available</td>
                                    </tr>
                            `}
                        </tbody>
                    </table>
                </div>

                <!-- Statistics Summary -->
                <div class="bg-gray-50 rounded-lg p-6">
                    <h4 class="text-md font-semibold text-gray-800 mb-4">Aggregate Statistics</h4>
                    <div class="space-y-4">
                        <div>
                            <p class="text-sm text-gray-600">Average Monthly Revenue</p>
                            <p class="text-lg font-semibold">$${formatNumber(safeAccess(statistics, 'revenue.average', 0))}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-600">Average Monthly Expenses</p>
                            <p class="text-lg font-semibold">$${formatNumber(safeAccess(statistics, 'expenses.average', 0))}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-600">Average Monthly Cash Flow</p>
                            <p class="text-lg font-semibold ${safeAccess(statistics, 'cashflow.average', 0) >= 0 ? 'text-green-600' : 'text-red-600'}">
                                $${formatNumber(safeAccess(statistics, 'cashflow.average', 0))}
                            </p>
                        </div>
                        <div class="pt-4 border-t border-gray-200">
                            <p class="text-sm text-gray-600">Standard Deviations</p>
                            <div class="grid grid-cols-2 gap-4 mt-2">
                                <div>
                                    <p class="text-xs text-gray-500">Revenue</p>
                                    <p class="text-sm font-medium">$${formatNumber(safeAccess(statistics, 'revenue.std_deviation', 0))}</p>
                                </div>
                                <div>
                                    <p class="text-xs text-gray-500">Expenses</p>
                                    <p class="text-sm font-medium">$${formatNumber(safeAccess(statistics, 'expenses.std_deviation', 0))}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

// Add this helper function to render each product section
function renderProductSection(productName, recommendation) {
    if (!recommendation) return '';
    
    const dataSourcesUsed = recommendation.analysis_based_on ? `
        <div class="data-sources mt-4 text-sm text-gray-600">
            <p>Analysis based on:</p>
            <ul class="list-disc pl-5">
                ${recommendation.analysis_based_on.used_bank_statements ? '<li>Bank Statements</li>' : ''}
                ${recommendation.analysis_based_on.used_tax_returns ? '<li>Tax Returns</li>' : ''}
            </ul>
        </div>
    ` : '';

    return `
        <div class="product-section mb-8">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-semibold">${recommendation.product_name}</h3>
                <div id="${productName}-status">
                    <span class="px-4 py-1 rounded-full text-sm font-semibold ${
                        recommendation.approval_decision === true
                            ? 'bg-green-100 text-green-800 border border-green-200'
                            : recommendation.approval_decision === "ERROR"
                            ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                            : 'bg-red-100 text-red-800 border border-red-200'
                    }">
                        ${recommendation.approval_decision === true 
                            ? 'Approved' 
                            : recommendation.approval_decision === "ERROR"
                            ? 'Error'
                            : 'Not Approved'}
                    </span>
                </div>
            </div>
            
            <!-- Rest of the existing product section code -->
            
            ${dataSourcesUsed}
        </div>
    `;
}

// Add this function to render document type indicators
function renderDocumentTypes(documentTypes) {
    return `
    <div class="document-types mb-4 flex gap-2">
        <span class="px-3 py-1 rounded-full text-sm font-medium ${
            documentTypes.has_bank_statements 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : 'bg-gray-100 text-gray-800 border border-gray-200'
        }">
            Bank Statements ${documentTypes.has_bank_statements ? '✓' : '✗'}
        </span>
        <span class="px-3 py-1 rounded-full text-sm font-medium ${
            documentTypes.has_tax_returns 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : 'bg-gray-100 text-gray-800 border border-gray-200'
        }">
            Tax Returns ${documentTypes.has_tax_returns ? '✓' : '✗'}
        </span>
    </div>`;
}

// Add this function to render analysis section
function renderAnalysisSection(analysis) {
    let bankAnalysis = '';
    let taxAnalysis = '';
    
    if (analysis.bank_statements) {
        if (analysis.bank_statements.error) {
            bankAnalysis = `
                <div class="error-message bg-red-50 border border-red-200 p-4 rounded-md mb-4">
                    <h4 class="text-red-800 font-medium">Bank Statement Analysis Error</h4>
                    <p class="text-red-600">${analysis.bank_statements.error.type}: ${
                        analysis.bank_statements.error.explanation || analysis.bank_statements.error.message
                    }</p>
                </div>`;
        } else {
            bankAnalysis = `
                <div class="bank-analysis bg-white p-4 rounded-md shadow-sm mb-4">
                    <h4 class="font-semibold text-gray-800 mb-2">Bank Statement Analysis</h4>
                    ${renderBankMetrics(analysis.bank_statements)}
                </div>`;
        }
    }
    
    if (analysis.tax_returns) {
        if (analysis.tax_returns.status === "pending") {
            taxAnalysis = `
                <div class="tax-analysis bg-yellow-50 border border-yellow-200 p-4 rounded-md mb-4">
                    <h4 class="font-semibold text-gray-800 mb-2">Tax Return Analysis</h4>
                    <p class="text-yellow-600">${analysis.tax_returns.message}</p>
                </div>`;
        } else {
            // Add tax return analysis rendering when implemented
            taxAnalysis = `
                <div class="tax-analysis bg-white p-4 rounded-md shadow-sm mb-4">
                    <h4 class="font-semibold text-gray-800 mb-2">Tax Return Analysis</h4>
                    ${renderTaxMetrics(analysis.tax_returns)}
                </div>`;
        }
    }
    
    return bankAnalysis + taxAnalysis;
}

// Helper function to render bank metrics
function renderBankMetrics(bankData) {
    if (!bankData) return '';
    
    return `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${bankData.continuity ? `
                <div class="metric-card">
                    <h5 class="text-sm font-medium text-gray-600">Statement Continuity</h5>
                    <p class="text-base">${bankData.continuity.analysis.is_contiguous ? 'Continuous' : 'Gaps Present'}</p>
                </div>
            ` : ''}
            ${bankData.monthly_financials ? `
                <div class="metric-card">
                    <h5 class="text-sm font-medium text-gray-600">Average Monthly Revenue</h5>
                    <p class="text-base">$${formatNumber(bankData.monthly_financials.average_monthly_revenue)}</p>
                </div>
            ` : ''}
            <!-- Add more metrics as needed -->
        </div>
    `;
}

// Update the existing handleAnalysisResults function
function handleAnalysisResults(response) {
    const resultsSection = document.getElementById('results-section');
    const summaryTab = document.querySelector('[data-tab="summary"]');
    
    if (!resultsSection || !summaryTab) return;
    
    // Show results section
    resultsSection.classList.remove('hidden');
    
    // Render document types
    const documentTypesHtml = renderDocumentTypes(response.document_types);
    
    // Render analysis sections
    const analysisHtml = renderAnalysisSection(response.analysis);
    
    // Render credit decisions
    const creditDecisionsHtml = response.loan_recommendations
        .map(rec => renderProductSection(rec.product_type, rec))
        .join('');
    
    // Update the summary tab content
    summaryTab.innerHTML = `
        ${documentTypesHtml}
        ${analysisHtml}
        <div class="credit-decisions mt-6">
            <h3 class="text-xl font-semibold mb-4">Credit Decisions</h3>
            ${creditDecisionsHtml}
        </div>
        
        <div class="analysis-metadata mt-6 text-sm text-gray-600">
            <p>Analysis completed at: ${new Date(response.analysis_metadata.analysis_timestamp * 1000).toLocaleString()}</p>
            <p>Provider used: ${response.analysis_metadata.provider_used}</p>
        </div>
    `;
}

// Add this helper function for number formatting
function formatNumber(number) {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number);
}

// Update the startAnalysis function to include merged_files
function startAnalysis(uploadResponse) {
    console.log('Starting analysis with:', uploadResponse); // Debug log
    
    // Show loading container
    document.querySelector('.loading-container').classList.remove('hidden');
    document.getElementById('results-section').classList.add('hidden');
    
    // Ensure we have the required data
    if (!uploadResponse || !uploadResponse.original_files || !uploadResponse.merged_files) {
        console.error('Invalid upload response:', uploadResponse);
        document.getElementById('error-message').textContent = 'Missing required data from upload';
        document.getElementById('error-container').classList.remove('hidden');
        document.querySelector('.loading-container').classList.add('hidden');
        return;
    }
    
    // Prepare the request data
    const requestData = {
        file_paths: uploadResponse.original_files || [],
        merged_files: uploadResponse.merged_files || {},
        provider: document.getElementById('llm-provider').value || 'openai',
        debug: false
    };

    console.log('Sending underwrite request:', requestData); // Debug log

    // Make the underwrite request
    fetch('/underwrite', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
    })
    .then(response => {
        console.log('Underwrite response status:', response.status); // Debug log
        if (!response.ok) {
            return response.json().then(err => {
                console.error('Underwrite error:', err); // Debug log
                throw new Error(err.error || 'Analysis failed');
            });
        }
        return response.json();
    })
    .then(response => {
        console.log('Analysis results:', response); // Debug log
        handleAnalysisResults(response);
    })
    .catch(error => {
        console.error('Analysis error:', error); // Debug log
        document.getElementById('error-message').textContent = error.message;
        document.getElementById('error-container').classList.remove('hidden');
        document.querySelector('.loading-container').classList.add('hidden');
    });

    // Start polling for status updates
    startStatusPolling();
}

// Update the handleUploadResponse function
function handleUploadResponse(response) {
    if (response.error) {
        document.getElementById('error-message').textContent = response.error;
        document.getElementById('error-container').classList.remove('hidden');
        return;
    }
    
    // Clear any previous errors
    document.getElementById('error-container').classList.add('hidden');
    
    // Start the analysis with the upload response
    startAnalysis(response);
}

// Add this function to handle file uploads
function handleFileUpload(files) {
    const formData = new FormData();
    for (let file of files) {
        formData.append('files', file);
    }

    // Show loading state
    document.querySelector('.loading-container').classList.remove('hidden');
    
    // Log what we're sending
    console.log('Uploading files:', files);

    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(uploadResponse => {
        console.log('Upload response:', uploadResponse); // Debug log
        
        if (uploadResponse.error) {
            throw new Error(uploadResponse.error);
        }
        
        // Store upload response in a data attribute for later use
        document.getElementById('upload-response').dataset.uploadData = JSON.stringify(uploadResponse);
        
        // Start analysis with the upload response
        startAnalysis(uploadResponse);
    })
    .catch(error => {
        console.error('Upload error:', error); // Debug log
        document.getElementById('error-message').textContent = error.message;
        document.getElementById('error-container').classList.remove('hidden');
        document.querySelector('.loading-container').classList.add('hidden');
    });
} 