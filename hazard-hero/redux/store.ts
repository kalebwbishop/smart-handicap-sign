import { combineReducers, configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import signsReducer from './signsSlice';

const rootReducer = combineReducers({
    signs: signsReducer,
    auth: authReducer,
});

const store = configureStore({
    reducer: rootReducer,
});

export default store;

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;