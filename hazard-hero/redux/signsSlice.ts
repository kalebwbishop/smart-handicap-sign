import { createSlice } from '@reduxjs/toolkit';

type Sign = {
    hsign_id: string;
    name: string;
    location: string;
    status: 'Ready' | 'Assist' | 'Offline';
};

interface SignState {
    data: { [key: string]: Sign };
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
}

const initialState: SignState = {
    data: {},
    status: 'idle',
    error: null,
};

const signsSlice = createSlice({
    name: 'signs',
    initialState: initialState,
    reducers: {
        // Add reducer functions here
        init: (state, action) => {
            state.data = action.payload;
        },
        set(state, action) {
            const { hsign_id, name, location, status } = action.payload;
            state.data = {
                ...state.data,
                [hsign_id]: { hsign_id, name, location, status },
            };

            console.log('Sign updated:', state.data[hsign_id]);
        }        
    }
});

export const { init, set } = signsSlice.actions;

export default signsSlice.reducer;
