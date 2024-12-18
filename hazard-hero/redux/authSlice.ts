import { createSlice } from '@reduxjs/toolkit';

type Auth = {
    token: string;
};

const initialState: Auth = {
    token: '',
};

const authSlice = createSlice({
    name: 'auth',
    initialState: initialState,
    reducers: {
        set(state, action) {
            state.token = action.payload;
        }
    }
});

export const { set } = authSlice.actions;

export default authSlice.reducer;
