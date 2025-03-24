document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const form = document.getElementById('upload-form');
    const fileInput = document.getElementById('file-input');
    const fileList = document.getElementById('file-list');
    const submitBtn = document.getElementById('submit-btn');
    const fileDropArea = document.getElementById('file-drop-area');
    const uploadStatus = document.getElementById('upload-status');
    const processingSection = document.getElementById('processing-section');
    const statusUpdates = document.getElementById('status-updates');
    const currentStatus = document.getElementById('current-status');
    
    // SSE connection
    let eventSource = null;
    
    // Array to store selected files
    let selectedFiles = [];
    
    // File input change handler
    fileInput.addEventListener('change', function(e) {
        handleFiles(e.target.files);
    });
    
    // Drag and drop handlers
    fileDropArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        fileDropArea.classList.add('border-blue-500', 'bg-blue-50');
    });
    
    fileDropArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        fileDropArea.classList.remove('border-blue-500', 'bg-blue-50');
    });
    
    fileDropArea.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        fileDropArea.classList.remove('border-blue-500', 'bg-blue-50');
        
        if (e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    });
    
    // Fix for the browse functionality
    // Find the browse span and add a specific click handler
    const browseSpan = fileDropArea.querySelector('span');
    if (browseSpan) {
        browseSpan.addEventListener('click', function(e) {
            e.stopPropagation(); // Stop event bubbling
            fileInput.click();
        });
        
        // Add cursor pointer to make it obviously clickable
        browseSpan.style.cursor = 'pointer';
    }
    
    // Ensure the entire drop area is still clickable
    fileDropArea.addEventListener('click', function() {
        fileInput.click();
    });
    
    // Process selected files
    function handleFiles(files) {
        const pdfFiles = Array.from(files).filter(file => 
            file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
        );
        
        if (pdfFiles.length === 0) {
            showUploadStatus('Please select PDF files only.', 'error');
            return;
        }
        
        selectedFiles = pdfFiles;
        updateFileList();
        submitBtn.disabled = selectedFiles.length === 0;
    }
    
    // Update file list in UI
    function updateFileList() {
        fileList.innerHTML = '';
        
        selectedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg';
            
            fileItem.innerHTML = `
                <div class="flex items-center">
                    <svg class="w-4 h-4 mr-2 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"></path>
                    </svg>
                    <span class="text-sm truncate max-w-xs">${file.name}</span>
                </div>
                <button type="button" class="text-red-500 hover:text-red-700" data-index="${index}">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            `;
            
            fileList.appendChild(fileItem);
        });
        
        // Add click listeners to remove buttons
        document.querySelectorAll('#file-list button').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                removeFile(index);
            });
        });
    }
    
    // Remove file at specific index
    function removeFile(index) {
        selectedFiles.splice(index, 1);
        updateFileList();
        submitBtn.disabled = selectedFiles.length === 0;
    }
    
    // Form submission handler
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
        if (selectedFiles.length === 0) {
            showUploadStatus('Please select at least one file.', 'error');
            return;
        }
        
        // Disable submit button during upload
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Uploading...
        `;
        
        try {
            showUploadStatus('Uploading files...', 'info');
            
            const formData = new FormData();
            
            // Add provider to form data
                const provider = document.getElementById('provider').value;
            formData.append('provider', provider);
            
            // Add debug flag
                const debugMode = document.getElementById('debug').checked;
            formData.append('debug', debugMode);
            
            // Add files to form data
            selectedFiles.forEach(file => {
                formData.append('files', file);
            });
            
            console.log('Starting upload with provider:', provider);
            
            // Send the form data to the server
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (response.ok) {
                console.log('Upload successful:', result);
                showUploadStatus('Files uploaded successfully. Starting analysis...', 'success');
                
                // Show processing section with animation
                processingSection.classList.remove('hidden');
                processingSection.style.opacity = '0';
                processingSection.style.transform = 'translateY(10px)';
                setTimeout(() => {
                    processingSection.style.transition = 'opacity 300ms, transform 300ms';
                    processingSection.style.opacity = '1';
                    processingSection.style.transform = 'translateY(0)';
                }, 10);
                
                // Start SSE connection for status updates
                connectToStatusEvents();
                
                // Continue with underwrite request
                processUnderwrite(result, provider, debugMode);
            } else {
                console.error('Upload failed:', result);
                showUploadStatus(`Upload failed: ${result.error || 'Unknown error'}`, 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Upload Files';
            }
        } catch (error) {
            console.error('Error during upload:', error);
            showUploadStatus(`Error during upload: ${error.message}`, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Upload Files';
        }
    });
    
    // Process the underwrite request
    async function processUnderwrite(uploadResult, provider, debugMode) {
        try {
            // Prepare request for underwrite endpoint
                const requestData = {
                file_paths: uploadResult.original_files,
                merged_files: uploadResult.merged_files,
                document_types: {
                    // Include the classification results from the upload process
                    bank_statements: uploadResult.summary.bank_statements,
                    tax_returns: uploadResult.summary.tax_returns
                },
                provider: provider,
                    debug: debugMode
                };
                
                console.log('Sending underwrite request:', requestData);

            // Send the request to the underwrite endpoint
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

            // Close SSE connection
            disconnectFromStatusEvents();
            
            // Hide processing section
            processingSection.classList.add('hidden');
            
            // Display the results
            showUploadStatus('Analysis complete!', 'success');
            
            // Re-enable submit button
            submitBtn.disabled = false;
            submitBtn.textContent = 'Upload Files';
            
            // Display results after analysis completes
            displayResults(result);
        } catch (error) {
            console.error('Error during underwriting:', error);
            
            showUploadStatus(`Error during analysis: ${error.message}`, 'error');
            
            // Close SSE connection
            disconnectFromStatusEvents();
            
            // Re-enable submit button
            submitBtn.disabled = false;
            submitBtn.textContent = 'Upload Files';
        }
    }
    
    // Connect to SSE status events
    function connectToStatusEvents() {
        // Close any existing connection
        disconnectFromStatusEvents();
        
        // Clear existing status updates
        statusUpdates.innerHTML = '';
        currentStatus.textContent = 'Initializing...';
        
        // Display selected provider
        document.getElementById('provider-display').textContent = document.getElementById('provider').value;
        
        // Connect to the status endpoint
        eventSource = new EventSource('/status');
        
        // Handle incoming messages
        eventSource.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                console.log('Status update received:', data);
                
                // Update status
                updateStatus(data);
            } catch (error) {
                console.error('Error parsing status update:', error, event.data);
            }
        };
        
        // Handle errors
        eventSource.onerror = function(error) {
            console.error('SSE connection error:', error);
            disconnectFromStatusEvents();
        };
    }
    
    // Disconnect from SSE events
    function disconnectFromStatusEvents() {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
    }
    
    // Update status with SSE data
    function updateStatus(data) {
        // Important: Server sends 'details' instead of 'message'
        const message = data.details || 'Processing...';
        
        // Update current status text
        currentStatus.textContent = message;
        
        // Get status container elements
        const statusContainer = document.querySelector('.current-status-container');
        const statusBadge = document.querySelector('.status-badge');
        const statusIconElement = document.querySelector('.status-icon');
        
        // Update badge and styling based on status
        if (data.status === 'Complete' || data.status === 'Success') {
            // Update to completed state
            statusBadge.textContent = 'Complete';
            statusBadge.className = 'text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full status-badge';
            statusContainer.className = 'bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4 mb-6 border-l-4 border-green-500 shadow-sm current-status-container';
            statusIconElement.innerHTML = `
                <svg class="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
            `;
            currentStatus.className = 'font-semibold text-green-800';
        } else if (data.status === 'Error') {
            // Update to error state
            statusBadge.textContent = 'Error';
            statusBadge.className = 'text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full status-badge';
            statusContainer.className = 'bg-gradient-to-r from-red-50 to-red-100 rounded-lg p-4 mb-6 border-l-4 border-red-500 shadow-sm current-status-container';
            statusIconElement.innerHTML = `
                <svg class="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
            `;
            currentStatus.className = 'font-semibold text-red-800';
        } else {
            // Default processing state (blue)
            statusBadge.textContent = 'Active';
            statusBadge.className = 'text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full status-badge';
            statusContainer.className = 'bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 mb-6 border-l-4 border-blue-500 shadow-sm current-status-container';
            statusIconElement.innerHTML = `
                <svg class="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            `;
            currentStatus.className = 'font-semibold text-blue-800';
        }
        
        // Create status item
        const statusItem = document.createElement('div');
        
        // Determine icon and color based on status value
        let statusColor, statusIconSvg;
        
        if (data.status === 'Complete' || data.status === 'Success') {
            statusColor = 'green';
            statusIconSvg = `<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>`;
        } else if (data.status === 'Error') {
            statusColor = 'red';
            statusIconSvg = `<svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>`;
        } else {
            // Default case for "Processing" or any other status
            statusColor = 'blue';
            statusIconSvg = `<svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>`;
        }
        
        // Get current timestamp
        const timestamp = new Date().toLocaleTimeString();
        
        // Create a data attribute to help with step tracking
        const stepKey = data.step || 'unknown';
        
        // Check if we already have an item for this step
        const existingItem = document.querySelector(`[data-step="${stepKey}"]`);
        if (existingItem) {
            // Update existing item instead of creating a new one
            existingItem.className = `p-4 bg-white hover:bg-${statusColor}-50 transition-colors duration-150`;
            existingItem.innerHTML = `
                <div class="flex items-start">
                    <div class="flex-shrink-0 mr-3">
                        ${statusIconSvg}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-start">
                            <p class="font-medium text-${statusColor}-700">${data.step || 'Processing'}</p>
                            <span class="text-xs text-gray-500">${timestamp}</span>
                        </div>
                        <p class="text-sm text-gray-600 mt-1">${message}</p>
                        <p class="text-xs text-${statusColor}-600 mt-1">${data.status || ''}</p>
                        </div>
                    </div>
            `;
            return;
        }
        
        // If no existing item, create new one
        statusItem.className = `p-4 bg-white hover:bg-${statusColor}-50 transition-colors duration-150`;
        statusItem.setAttribute('data-step', stepKey);
        
        // Create status content
        statusItem.innerHTML = `
            <div class="flex items-start">
                <div class="flex-shrink-0 mr-3">
                    ${statusIconSvg}
                        </div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-start">
                        <p class="font-medium text-${statusColor}-700">${data.step || 'Processing'}</p>
                        <span class="text-xs text-gray-500">${timestamp}</span>
                        </div>
                    <p class="text-sm text-gray-600 mt-1">${message}</p>
                    <p class="text-xs text-${statusColor}-600 mt-1">${data.status || ''}</p>
                </div>
            </div>
        `;
        
        // Add to status updates with animation
        statusItem.style.opacity = '0';
        statusItem.style.transform = 'translateY(-10px)';
        statusUpdates.prepend(statusItem);
        
        // Animate in
        setTimeout(() => {
            statusItem.style.transition = 'opacity 300ms, transform 300ms';
            statusItem.style.opacity = '1';
            statusItem.style.transform = 'translateY(0)';
        }, 10);
        
        // Limit number of updates to display
        if (statusUpdates.children.length > 50) {
            statusUpdates.removeChild(statusUpdates.lastChild);
        }
    }
    
    // Display upload status message
    function showUploadStatus(message, type = 'info') {
        uploadStatus.textContent = message;
        uploadStatus.classList.remove('hidden', 'bg-blue-50', 'bg-green-50', 'bg-red-50', 'text-blue-700', 'text-green-700', 'text-red-700');
        
        switch (type) {
            case 'success':
                uploadStatus.classList.add('bg-green-50', 'text-green-700');
                break;
            case 'error':
                uploadStatus.classList.add('bg-red-50', 'text-red-700');
                break;
            default: // info
                uploadStatus.classList.add('bg-blue-50', 'text-blue-700');
                break;
        }
        
        // Automatically hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                uploadStatus.classList.add('hidden');
            }, 5000);
        }
    }

    // Function to display results after analysis completes
    function displayResults(responseData) {
        console.log('Displaying results with data:', responseData);
        
        // Create results container if it doesn't exist
        if (!document.getElementById('results-section')) {
            const resultsSection = document.createElement('section');
            resultsSection.id = 'results-section';
            resultsSection.className = 'mt-8 bg-white rounded-lg shadow-md';
            resultsSection.innerHTML = `
                <div class="border-b border-gray-200">
                    <nav class="flex flex-wrap px-4 py-2">
                        <button class="tab-button flex items-center justify-center px-5 py-3 m-1 rounded-md bg-blue-50 active-tab" data-tab="summary-tab">
                            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                            <span>Decision Summary</span>
                </button>
                        <button class="tab-button flex items-center justify-center px-5 py-3 m-1 rounded-md hover:bg-gray-50" data-tab="financial-tab">
                            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                            </svg>
                            <span>Financial Summary</span>
                        </button>
                        <button class="tab-button flex items-center justify-center px-5 py-3 m-1 rounded-md hover:bg-gray-50" data-tab="credit-tab">
                            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m-6-8h6M5 5h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
                            </svg>
                            <span>Credit Analysis</span>
                        </button>
                        <button class="tab-button flex items-center justify-center px-5 py-3 m-1 rounded-md hover:bg-gray-50" data-tab="raw-tab">
                            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                            </svg>
                            <span>Raw JSON</span>
                        </button>
                    </nav>
            </div>
                
                <div class="tab-content p-6" id="summary-tab"></div>
                <div class="tab-content p-6 hidden" id="financial-tab"></div>
                <div class="tab-content p-6 hidden" id="credit-tab"></div>
                <div class="tab-content p-6 hidden" id="raw-tab"></div>
            `;
            
            // Insert before processing section
            document.querySelector('#processing-section').after(resultsSection);
            
            // Add tab switching functionality
            document.querySelectorAll('.tab-button').forEach(button => {
                button.addEventListener('click', function() {
                    // Remove active class from all tabs
                    document.querySelectorAll('.tab-button').forEach(btn => {
                        btn.classList.remove('active-tab', 'bg-blue-50');
                        btn.classList.add('hover:bg-gray-50');
                    });
                    
                    // Hide all tab content
                    document.querySelectorAll('.tab-content').forEach(content => {
                        content.classList.add('hidden');
                    });
                    
            // Add active class to clicked tab
                    this.classList.add('active-tab', 'bg-blue-50');
                    this.classList.remove('hover:bg-gray-50');
                    
                    // Show corresponding tab content
                    const tabId = this.getAttribute('data-tab');
                    document.getElementById(tabId).classList.remove('hidden');
        });
    });
        }
        
        // Update each tab with content
        updateSummaryTab(responseData);
        updateFinancialTab(responseData);
        updateCreditTab(responseData);
        updateRawTab(responseData);
    }

    // Tab 1: Decision Summary
    function updateSummaryTab(data) {
        const summaryTab = document.getElementById('summary-tab');
        
        // Clear previous content
        summaryTab.innerHTML = '';
        
        // Header
        const header = document.createElement('div');
        header.className = 'mb-6';
        header.innerHTML = `
            <h2 class="text-2xl font-bold text-gray-800 mb-2">Credit Decision Summary</h2>
            <p class="text-gray-600">Analysis completed at ${new Date().toLocaleString()}</p>
        `;
        summaryTab.appendChild(header);
        
        // Check if loan_recommendations exists and is an array
        if (!data.loan_recommendations || !Array.isArray(data.loan_recommendations) || data.loan_recommendations.length === 0) {
            // Display a message if no loan recommendations are available
            const noDataMsg = document.createElement('div');
            noDataMsg.className = 'p-4 bg-yellow-50 border border-yellow-200 rounded-md';
            noDataMsg.innerHTML = `
                <p class="text-yellow-700">No loan recommendations available in the response.</p>
                <p class="text-sm text-gray-600 mt-2">Raw response: ${JSON.stringify(data).substring(0, 150)}...</p>
            `;
            summaryTab.appendChild(noDataMsg);
            return;
        }
        
        // Create container for cards
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'grid grid-cols-1 md:grid-cols-2 gap-6';
        
        // Process each product in the loan_recommendations array
        data.loan_recommendations.forEach(product => {
            // Convert approval_decision to string and handle null/undefined/boolean values
            const approvalDecision = typeof product.approval_decision === 'string' 
                ? product.approval_decision 
                : (product.approval_decision === true ? 'APPROVED' : 'DECLINED');
            
            console.log('Product:', product.product_name, 'Approval decision:', approvalDecision, 'Type:', typeof product.approval_decision);
            
            const card = document.createElement('div');
            card.className = 'border rounded-lg shadow-sm overflow-hidden';
            
            // Determine color based on approval
            let borderColor, bgColor, textColor;
            if (approvalDecision === 'APPROVED') {
                borderColor = 'border-green-500';
                bgColor = 'bg-green-50';
                textColor = 'text-green-800';
            } else if (approvalDecision === 'DECLINED') {
                borderColor = 'border-red-500';
                bgColor = 'bg-red-50';
                textColor = 'text-red-800';
            } else if (approvalDecision === 'MANUAL_REVIEW') {
                borderColor = 'border-yellow-500';
                bgColor = 'bg-yellow-50';
                textColor = 'text-yellow-800';
            } else {
                borderColor = 'border-gray-500';
                bgColor = 'bg-gray-50';
                textColor = 'text-gray-800';
            }
            
            card.innerHTML = `
                <div class="px-6 py-4 ${bgColor} border-b ${borderColor}">
                    <div class="flex justify-between items-center">
                        <h3 class="text-lg font-semibold">${product.product_name}</h3>
                        <span class="px-3 py-1 rounded-full text-sm font-medium ${textColor} ${bgColor}">
                            ${approvalDecision.replace(/_/g, ' ')}
                        </span>
                    </div>
                </div>
                <div class="p-6">
                    <div class="mb-4">
                        <p class="text-gray-700">
                            ${product.detailed_analysis ? product.detailed_analysis.substring(0, 200) + '...' : 'No detailed analysis available'}
                        </p>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <p class="text-sm text-gray-500">Max Loan Amount</p>
                            <p class="text-lg font-semibold">$${(product.max_loan_amount || 0).toLocaleString()}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">Confidence Score</p>
                            <p class="text-lg font-semibold">${Math.round((product.confidence_score || 0) * 100)}%</p>
                        </div>
                    </div>
                </div>
            `;
            
            cardsContainer.appendChild(card);
        });
        
        summaryTab.appendChild(cardsContainer);
    }

    // Tab 2: Financial Summary
    function updateFinancialTab(data) {
        const financialTab = document.getElementById('financial-tab');
        
        // Clear previous content
        financialTab.innerHTML = '';
        
        // Header
        const header = document.createElement('div');
        header.className = 'mb-6';
        header.innerHTML = `
            <h2 class="text-2xl font-bold text-gray-800 mb-2">Financial Summary</h2>
            <p class="text-gray-600">Analysis of banking activity and financial health</p>
        `;
        financialTab.appendChild(header);
        
        // Get bank statement analysis data
        const bankStatementAnalysis = data.analysis?.bank_statements || {};
        const hasAnalysisData = Object.keys(bankStatementAnalysis).length > 0;
        
        if (!hasAnalysisData) {
            const noDataMsg = document.createElement('div');
            noDataMsg.className = 'p-4 bg-yellow-50 border border-yellow-200 rounded-md';
            noDataMsg.innerHTML = `
                <p class="text-yellow-700">No financial analysis data available.</p>
                <p class="text-sm text-gray-600 mt-2">Make sure bank statements were analyzed.</p>
            `;
            financialTab.appendChild(noDataMsg);
            return;
        }
        
        // Create layout for financial cards and chart
        const layout = document.createElement('div');
        layout.className = 'grid grid-cols-1 lg:grid-cols-3 gap-6';
        
        // 1. Daily Balances Chart Card (spans full width on small screens, 2/3 on large)
        const chartCard = document.createElement('div');
        chartCard.className = 'border rounded-lg shadow-sm p-6 lg:col-span-2';
        chartCard.innerHTML = `
            <h3 class="text-lg font-semibold mb-4">Daily Balance Trend</h3>
            <div class="h-64">
                <canvas id="daily-balance-chart"></canvas>
            </div>
        `;
        
        // 2. Monthly Balances Card
        const monthlyCard = document.createElement('div');
        monthlyCard.className = 'border rounded-lg shadow-sm p-6';
        
        // Get the closing balances data if available
        const closingBalances = bankStatementAnalysis.closing_balances || {};
        
        // Get key metrics from the first loan recommendation if available
        const metrics = data.loan_recommendations && data.loan_recommendations.length > 0 
            ? data.loan_recommendations[0].key_metrics || {} 
            : {};
        
        monthlyCard.innerHTML = `
            <h3 class="text-lg font-semibold mb-4">Monthly Balances</h3>
            <div class="space-y-4">
                <div>
                    <p class="text-sm text-gray-500">Lowest Monthly Balance</p>
                    <p class="text-lg font-semibold">$${(metrics.lowest_monthly_balance || 0).toLocaleString()}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-500">Average Daily Balance Trend</p>
                    <p class="text-lg font-semibold">${metrics.average_daily_balance_trend || 'N/A'}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-500">Payment Coverage Ratio</p>
                    <p class="text-lg font-semibold">${(metrics.payment_coverage_ratio || 0).toFixed(2)}</p>
                </div>
            </div>
        `;
        
        // 3. Revenue & Expenses Card
        const revenueCard = document.createElement('div');
        revenueCard.className = 'border rounded-lg shadow-sm p-6';
        
        // Get monthly financials data if available
        const monthlyFinancials = bankStatementAnalysis.monthly_financials || {};
        
        revenueCard.innerHTML = `
            <h3 class="text-lg font-semibold mb-4">Revenue & Expenses</h3>
            <div class="space-y-4">
                <div>
                    <p class="text-sm text-gray-500">Total Revenue</p>
                    <p class="text-lg font-semibold text-green-600">$${(monthlyFinancials.total_revenue || 0).toLocaleString()}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-500">Total Expenses</p>
                    <p class="text-lg font-semibold text-red-600">$${(monthlyFinancials.total_expenses || 0).toLocaleString()}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-500">Net Cash Flow</p>
                    <p class="text-lg font-semibold">$${(monthlyFinancials.net_cashflow || 0).toLocaleString()}</p>
            </div>
            </div>
        `;
        
        // 4. NSF Card
        const nsfCard = document.createElement('div');
        nsfCard.className = 'border rounded-lg shadow-sm p-6';
        
        // Get NSF information if available
        const nsfInfo = bankStatementAnalysis.nsf_information || {};
        
        nsfCard.innerHTML = `
            <h3 class="text-lg font-semibold mb-4">Non-Sufficient Funds</h3>
            <div class="space-y-4">
                <div>
                    <p class="text-sm text-gray-500">Total NSF Incidents</p>
                    <p class="text-lg font-semibold">${nsfInfo.incident_count || 0}</p>
                    </div>
                <div>
                    <p class="text-sm text-gray-500">Highest NSF Month Count</p>
                    <p class="text-lg font-semibold">${metrics.highest_nsf_month_count || 0}</p>
                    </div>
                <div>
                    <p class="text-sm text-gray-500">Total NSF Fees</p>
                    <p class="text-lg font-semibold">$${(nsfInfo.total_fees || 0).toLocaleString()}</p>
                    </div>
                    </div>
    `;
        
        // Add all cards to the layout
        layout.appendChild(chartCard);
        layout.appendChild(monthlyCard);
        layout.appendChild(revenueCard);
        layout.appendChild(nsfCard);
        
        financialTab.appendChild(layout);
        
        // Create chart if we have daily balance data
        setTimeout(() => {
            ensureChartJsLoaded()
                .then(() => {
                    if (document.getElementById('daily-balance-chart')) {
                        createDailyBalanceChart(bankStatementAnalysis.daily_balances || {});
                    }
                })
                .catch(error => {
                    console.error('Error loading Chart.js:', error);
                    // Add a message in place of the chart
                    const chartContainer = document.getElementById('daily-balance-chart');
                    if (chartContainer) {
                        chartContainer.parentElement.innerHTML = `
                            <div class="flex items-center justify-center h-64 bg-gray-50 rounded border border-gray-200">
                                <p class="text-gray-500">Chart could not be loaded</p>
        </div>
    `;
                    }
                });
        }, 100);
    }

    // Function to create the daily balance chart
    function createDailyBalanceChart(dailyBalancesData) {
        // Extract dates and balances from the data if available
        let dates = [];
        let balances = [];
        
        // If there's a balances array, use it, otherwise generate sample data
        if (dailyBalancesData && dailyBalancesData.balances && dailyBalancesData.balances.length > 0) {
            dailyBalancesData.balances.forEach(item => {
                dates.push(item.date);
                balances.push(item.balance);
            });
        } else {
            // Generate sample data
            const endDate = new Date();
            for (let i = 29; i >= 0; i--) {
                const date = new Date();
                date.setDate(endDate.getDate() - i);
                dates.push(date.toLocaleDateString());
                
                // Generate random balance between 1000 and 5000
                const balance = Math.floor(Math.random() * 4000) + 1000;
                balances.push(balance);
            }
        }
        
        // Create chart
        const ctx = document.getElementById('daily-balance-chart').getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                labels: dates,
                    datasets: [{
                        label: 'Daily Balance',
                    data: balances,
                    backgroundColor: 'rgba(59, 130, 246, 0.2)', // blue-500 with opacity
                    borderColor: 'rgb(59, 130, 246)', // blue-500
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                        beginAtZero: false,
                        grid: {
                            drawBorder: false
                        },
                            ticks: {
                                callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxTicksLimit: 7
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return '$' + context.raw.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    // Tab 3: Credit Analysis
    function updateCreditTab(data) {
        const creditTab = document.getElementById('credit-tab');
        
        // Clear previous content
        creditTab.innerHTML = '';
        
        // Header
        const header = document.createElement('div');
        header.className = 'mb-6';
        header.innerHTML = `
            <h2 class="text-2xl font-bold text-gray-800 mb-2">Credit Analysis</h2>
            <p class="text-gray-600">Risk assessment and lending recommendations</p>
        `;
        creditTab.appendChild(header);
        
        // Check if loan_recommendations exists and is an array
        if (!data.loan_recommendations || !Array.isArray(data.loan_recommendations) || data.loan_recommendations.length === 0) {
            // Display a message if no loan recommendations are available
            const noDataMsg = document.createElement('div');
            noDataMsg.className = 'p-4 bg-yellow-50 border border-yellow-200 rounded-md';
            noDataMsg.innerHTML = `
                <p class="text-yellow-700">No credit analysis data available in the response.</p>
            `;
            creditTab.appendChild(noDataMsg);
            return;
        }
        
        // Create container for product analysis cards
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'space-y-8';
        
        // Process each product in the loan_recommendations array
        data.loan_recommendations.forEach(product => {
            // Convert approval_decision to string and handle null/undefined/boolean values
            const approvalDecision = typeof product.approval_decision === 'string' 
                ? product.approval_decision 
                : (product.approval_decision === true ? 'APPROVED' : 'DECLINED');
            
            const productCard = document.createElement('div');
            productCard.className = 'border rounded-lg shadow-sm overflow-hidden';
            
            // Determine header color based on approval
            let headerBg, headerText;
            if (approvalDecision === 'APPROVED') {
                headerBg = 'bg-green-50';
                headerText = 'text-green-800';
            } else if (approvalDecision === 'DECLINED') {
                headerBg = 'bg-red-50';
                headerText = 'text-red-800';
            } else if (approvalDecision === 'MANUAL_REVIEW') {
                headerBg = 'bg-yellow-50';
                headerText = 'text-yellow-800';
            } else {
                headerBg = 'bg-gray-50';
                headerText = 'text-gray-800';
            }
            
            productCard.innerHTML = `
                <div class="px-6 py-4 ${headerBg} border-b">
                    <h3 class="text-lg font-semibold ${headerText}">${product.product_name}</h3>
                    <div class="flex items-center mt-1">
                        <span class="text-sm font-medium">Decision: ${approvalDecision.replace(/_/g, ' ')}</span>
                        <span class="mx-2">•</span>
                        <span class="text-sm">Confidence: ${Math.round((product.confidence_score || 0) * 100)}%</span>
                        </div>
                        </div>
                <div class="p-6">
                    <!-- Detailed Analysis -->
                    <div class="mb-6">
                        <h4 class="text-base font-medium mb-2">Detailed Analysis</h4>
                        <p class="text-gray-700">${product.detailed_analysis || 'No detailed analysis available'}</p>
                        </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <!-- Risk Factors -->
                                <div>
                            <h4 class="text-base font-medium mb-2 text-red-600">Risk Factors</h4>
                            ${product.risk_factors && product.risk_factors.length ? `
                                <ul class="list-disc pl-5 space-y-1">
                                    ${product.risk_factors.map(factor => `
                                        <li class="text-gray-700">${factor}</li>
                                    `).join('')}
                                </ul>
                            ` : '<p class="text-gray-500">No risk factors identified</p>'}
                                </div>
                        
                        <!-- Mitigating Factors -->
                                <div>
                            <h4 class="text-base font-medium mb-2 text-green-600">Mitigating Factors</h4>
                            ${product.mitigating_factors && product.mitigating_factors.length ? `
                                <ul class="list-disc pl-5 space-y-1">
                                    ${product.mitigating_factors.map(factor => `
                                        <li class="text-gray-700">${factor}</li>
                                    `).join('')}
                                </ul>
                            ` : '<p class="text-gray-500">No mitigating factors identified</p>'}
                                </div>
                            </div>
                    
                    <!-- Conditions if Approved -->
                    ${approvalDecision === 'APPROVED' || approvalDecision === 'MANUAL_REVIEW' ? `
                        <div class="mt-6">
                            <h4 class="text-base font-medium mb-2 text-blue-600">Conditions if Approved</h4>
                            ${product.conditions_if_approved && product.conditions_if_approved.length ? `
                                <ul class="list-disc pl-5 space-y-1">
                                    ${product.conditions_if_approved.map(condition => `
                                        <li class="text-gray-700">${condition}</li>
                                    `).join('')}
            </ul>
                            ` : '<p class="text-gray-500">No specific conditions</p>'}
                        </div>
                    ` : ''}
            </div>
        `;
            
            cardsContainer.appendChild(productCard);
        });
        
        creditTab.appendChild(cardsContainer);
    }

    // Tab 4: Raw JSON
    function updateRawTab(data) {
        const rawTab = document.getElementById('raw-tab');
        
        // Clear previous content
        rawTab.innerHTML = '';
        
        // Header
        const header = document.createElement('div');
        header.className = 'mb-6 flex justify-between items-center';
        header.innerHTML = `
            <h2 class="text-2xl font-bold text-gray-800">Raw JSON Response</h2>
            <button id="copy-json-btn" class="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded flex items-center">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
                Copy JSON
            </button>
        `;
        rawTab.appendChild(header);
        
        // JSON display
        const jsonContainer = document.createElement('div');
        jsonContainer.className = 'border rounded-lg overflow-hidden bg-gray-50';
        
        // Format the JSON with syntax highlighting
        const jsonString = JSON.stringify(data, null, 2);
        
        jsonContainer.innerHTML = `
            <pre class="p-6 overflow-auto max-h-96 text-sm">${escapeHtml(jsonString)}</pre>
        `;
        
        rawTab.appendChild(jsonContainer);
        
        // Add copy functionality
        document.getElementById('copy-json-btn').addEventListener('click', function() {
            navigator.clipboard.writeText(jsonString).then(() => {
                // Show success feedback
                this.innerHTML = `
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                `;
                this.classList.remove('bg-gray-100', 'hover:bg-gray-200', 'text-gray-700');
                this.classList.add('bg-green-100', 'text-green-700');
                
                // Reset after 2 seconds
                setTimeout(() => {
                    this.innerHTML = `
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                        </svg>
                        Copy JSON
                    `;
                    this.classList.add('bg-gray-100', 'hover:bg-gray-200', 'text-gray-700');
                    this.classList.remove('bg-green-100', 'text-green-700');
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy JSON:', err);
                
                // Show error feedback
                this.innerHTML = `
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Copy failed
                `;
                this.classList.remove('bg-gray-100', 'hover:bg-gray-200', 'text-gray-700');
                this.classList.add('bg-red-100', 'text-red-700');
                
                // Reset after 2 seconds
                setTimeout(() => {
                    this.innerHTML = `
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                        </svg>
                        Copy JSON
                    `;
                    this.classList.add('bg-gray-100', 'hover:bg-gray-200', 'text-gray-700');
                    this.classList.remove('bg-red-100', 'text-red-700');
                }, 2000);
            });
        });
    }

    // Helper function to escape HTML
    function escapeHtml(html) {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    }

    // ADD THIS NEW CODE: Move the "Load JSON" button to bottom left 
    // Find the submit button container
    const submitContainer = document.querySelector('#upload-form .flex.justify-end');
    
    // Change the container to have content at both ends
    submitContainer.className = 'flex justify-between items-center';
    
    // Create the "Load JSON" button
    const testJsonBtn = document.createElement('button');
    testJsonBtn.id = 'test-json-btn';
    testJsonBtn.className = 'bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded-lg text-sm font-medium flex items-center';
    testJsonBtn.innerHTML = `
        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 4v4M15 4v4M9 16l3-3 3 3M12 13v6"></path>
        </svg>
        Load JSON
    `;
    
    // Insert the button at the beginning of the container
    submitContainer.insertBefore(testJsonBtn, submitContainer.firstChild);
    
    // Create the modal dialog for JSON input (hidden by default)
    const modal = document.createElement('div');
    modal.id = 'json-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 m-4">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-semibold text-gray-900">Paste JSON for Testing</h3>
                <button id="close-modal" class="text-gray-400 hover:text-gray-500">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
        </div>
            <div class="mb-4">
                <p class="text-sm text-gray-600 mb-2">Paste a mock of the master_response JSON to test UI rendering:</p>
                <textarea id="json-input" class="w-full h-64 border border-gray-300 rounded p-2 font-mono text-sm" placeholder='{"provider":"openai","loan_recommendations":[...]}'></textarea>
            </div>
            <div class="flex justify-end space-x-3">
                <button id="load-sample-json" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded">
                    Load Sample
                </button>
                <button id="load-json" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded">
                    Test JSON
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Sample JSON for testing
    const sampleJson = {
        "provider": "openai",
        "loan_recommendations": [
            {
                "product_type": "term_loan",
                "product_name": "Term Loan",
                "approval_decision": "APPROVED",
                "confidence_score": 0.85,
                "max_loan_amount": 25000,
                "max_monthly_payment_amount": 2300,
                "detailed_analysis": "Based on the bank statements provided, the business demonstrates strong and consistent cash flow. The average daily balance is trending upward over the past 3 months, and there are no NSF incidents. The business shows regular revenue deposits and has maintained adequate reserves to cover the proposed loan payments.",
                "mitigating_factors": [
                    "Strong upward trend in account balance",
                    "No NSF incidents in the past 6 months",
                    "Regular revenue deposits averaging $12,500 per month",
                    "Consistent payment history to vendors"
                ],
                "risk_factors": [
                    "Business is relatively new (less than 2 years)",
                    "Seasonal fluctuations in revenue observed"
                ],
                "conditions_if_approved": [
                    "Maintain minimum balance of $5,000",
                    "Provide quarterly financial updates",
                    "Personal guarantee required"
                ],
                "key_metrics": {
                    "payment_coverage_ratio": 1.8,
                    "average_daily_balance_trend": "increasing",
                    "lowest_monthly_balance": 7500,
                    "highest_nsf_month_count": 0,
                    "total_revenue": 145000,
                    "total_expenses": 98000,
                    "net_cashflow": 47000
                },
                "analysis_based_on": {
                    "used_bank_statements": true,
                    "used_tax_returns": false
                }
            },
            {
                "product_type": "accounts_payable",
                "product_name": "Accounts Payable Financing",
                "approval_decision": "MANUAL_REVIEW",
                "confidence_score": 0.65,
                "max_loan_amount": 15000,
                "max_monthly_payment_amount": 1800,
                "detailed_analysis": "The business shows adequate cash flow for smaller AP financing amounts. While overall financials are positive, the inconsistent payment patterns to suppliers suggest a careful review is needed before establishing a larger credit limit. A 60-day term is recommended based on the observed cash flow cycle.",
                "mitigating_factors": [
                    "Positive overall cash flow",
                    "Good account balance reserves",
                    "No returned payments to vendors"
                ],
                "risk_factors": [
                    "Irregular payment patterns to suppliers",
                    "Occasional large withdrawals affecting liquidity",
                    "Some months show tight cash flow margins"
                ],
                "conditions_if_approved": [
                    "Start with lower credit limit of $15,000",
                    "Review performance after 3 months for potential increase",
                    "Provide complete AP aging report"
                ],
                "key_metrics": {
                    "payment_coverage_ratio": 1.3,
                    "average_daily_balance_trend": "stable",
                    "lowest_monthly_balance": 5200,
                    "highest_nsf_month_count": 0,
                    "total_revenue": 145000,
                    "total_expenses": 98000,
                    "net_cashflow": 47000
                },
                "analysis_based_on": {
                    "used_bank_statements": true,
                    "used_tax_returns": false
                }
            }
        ],
        "analysis": {
            "bank_statements": {
                "continuity": {
                    "continuous": true,
                    "missing_periods": [],
                    "statement_periods": [
                        {"start_date": "2023-01-01", "end_date": "2023-01-31"},
                        {"start_date": "2023-02-01", "end_date": "2023-02-28"},
                        {"start_date": "2023-03-01", "end_date": "2023-03-31"}
                    ]
                },
                "daily_balances": {
                    "balances": [
                        {"date": "2023-01-02", "balance": 10250.45},
                        {"date": "2023-01-15", "balance": 12340.78},
                        {"date": "2023-01-31", "balance": 8975.52},
                        {"date": "2023-02-15", "balance": 15320.65},
                        {"date": "2023-02-28", "balance": 11430.22},
                        {"date": "2023-03-15", "balance": 18540.33},
                        {"date": "2023-03-31", "balance": 22710.89}
                    ],
                    "average_balance": 14224.12,
                    "min_balance": 8975.52,
                    "max_balance": 22710.89
                },
                "nsf_information": {
                    "incident_count": 0,
                    "total_fees": 0,
                    "nsf_incidents": []
                },
                "closing_balances": {
                    "monthly_balances": [
                        {"month": "2023-01", "balance": 8975.52},
                        {"month": "2023-02", "balance": 11430.22},
                        {"month": "2023-03", "balance": 22710.89}
                    ],
                    "average_closing_balance": 14372.21,
                    "trend": "increasing"
                },
                "monthly_financials": {
                    "monthly_data": [
                        {
                            "month": "2023-01",
                            "revenue": 42500.00,
                            "expenses": 35750.45,
                            "net_cashflow": 6749.55
                        },
                        {
                            "month": "2023-02",
                            "revenue": 45750.30,
                            "expenses": 29500.20,
                            "net_cashflow": 16250.10
                        },
                        {
                            "month": "2023-03",
                            "revenue": 56750.25,
                            "expenses": 32750.33,
                            "net_cashflow": 24000.00
                        }
                    ],
                    "total_revenue": 145000.55,
                    "total_expenses": 98000.98,
                    "net_cashflow": 47000.00
                }
            },
            "tax_returns": {
                "status": "not_provided",
                "message": "No tax return documents were provided for analysis"
            }
        },
        "document_types": {
            "has_bank_statements": true,
            "has_tax_returns": false
        }
    };
    
    // Event handler for "Load JSON" button
    testJsonBtn.addEventListener('click', function() {
        modal.classList.remove('hidden');
    });
    
    // Event handlers for modal
    document.getElementById('close-modal').addEventListener('click', function() {
        modal.classList.add('hidden');
    });
    
    document.getElementById('load-sample-json').addEventListener('click', function() {
        document.getElementById('json-input').value = JSON.stringify(sampleJson, null, 2);
    });
    
    document.getElementById('load-json').addEventListener('click', function() {
        try {
            const jsonText = document.getElementById('json-input').value;
            const data = JSON.parse(jsonText);
            
            // Hide processing section and close modal
            processingSection.classList.add('hidden');
            modal.classList.add('hidden');
            
            // Show success message
            showUploadStatus('Test JSON loaded successfully!', 'success');
            
            // Display the results using the mock data
            displayResults(data);
            
            // If there's an existing results section, scroll to it
            const resultsSection = document.getElementById('results-section');
            if (resultsSection) {
                resultsSection.scrollIntoView({ behavior: 'smooth' });
            }
        } catch (error) {
            console.error('Error parsing JSON:', error);
            
            // Show error message
            showUploadStatus('Error parsing JSON: ' + error.message, 'error');
        }
    });
    
    // Close modal if user clicks outside of it
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });

    // Add this function at the beginning of your script.js file, before displayResults function
    function ensureChartJsLoaded() {
        if (window.Chart) {
            return Promise.resolve(); // Chart.js already loaded
        }
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load Chart.js'));
            document.head.appendChild(script);
        });
    }
}); 