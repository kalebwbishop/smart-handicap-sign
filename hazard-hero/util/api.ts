import axios from 'axios';
import { API_BASE_URL } from '@/config';
import { router } from 'expo-router';

const FUNCTIONS_KEY = 'AZURE_FUNCTION_KEY'

const getAuthToken = async () => {
    // Replace with your actual token retrieval logic
    const token = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ii1JeDlBaFdQclhqTms4TlhOY2VTOSJ9.eyJpc3MiOiJodHRwczovL2Rldi03dTB4NGt0cHYwcnBza20wLnVzLmF1dGgwLmNvbS8iLCJzdWIiOiJnb29nbGUtb2F1dGgyfDEwMTU0NTM1MDkxOTgzMTc5NTE0OCIsImF1ZCI6WyJodHRwOi8vMTcyLjIwLjEwLjI6NzA3MS8iLCJodHRwczovL2Rldi03dTB4NGt0cHYwcnBza20wLnVzLmF1dGgwLmNvbS91c2VyaW5mbyJdLCJpYXQiOjE3MzQzOTExMzMsImV4cCI6MTczNDQ3NzUzMywic2NvcGUiOiJvcGVuaWQgcHJvZmlsZSBlbWFpbCIsImF6cCI6InN0emM3dmpUUzRPVDlwelV2TFJoUTFKZ1pWV3hVN3Y3In0.TU3boz6NZua7OHhGFNgfrw5wC-GOdc1WVPyFLDVSPKjjTqMdyBMLnI2BrINoV9Yi7gvEJKuQGc-ejhN0O0wtJ6vZ0gAhL8Wfg_b9gS14iDix7IqhyzL2NNG_7diAyIwWhknrZIZLCoIKhXyt4JOmtMgNAPqXvPULd22jk2fhXhX-xM3aeId_rBaIIvKYhuqQAamO0osJt6gICEyjy9BvI3e3he4YqciOLuG5aGB3dgnfTLSNa7ACWPruXsmPKNiZkkcRCihi3mO1jhSXx8EPE_LdsPjlqt7Bf-tBWj4NGYB_bqbIR2iVU-peDsQAJrgRprGY1KrQenBMz8qBbHFf-Q';
    if (!token) {
        router.replace('/Auth');
    }
    return token;
};

// Common GET and POST request utility
const apiRequest = async (method, endpoint, data = null) => {
    const token = await getAuthToken(); // Get the auth token
    const url = `${API_BASE_URL}${endpoint}`; // Construct full URL

    try {
        const response = await axios({
            method: method,
            url: url,
            data: method === 'POST' ? data : null,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`, // Include Authorization header
                'x-functions-key': FUNCTIONS_KEY
            },
        });
        return response.data; // Return only the response data
    } catch (error) {
        console.error(`Error in ${method} ${url}:`, error.response || error.message);
        throw error; // Throw error for handling in calling function
    }
};

const getRequest = async (endpoint: string) => {
    const authToken = await getAuthToken();
    const response = await axios.get(`${API_BASE_URL}${endpoint}`, {
        headers: {
            Authorization: `Bearer ${authToken}`,
            'x-functions-key': FUNCTIONS_KEY,
        },
    }
    );

    return response.data;
}

// Export reusable functions
export const postRequest = (endpoint, data) => apiRequest('POST', endpoint);

export { getRequest };