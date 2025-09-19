import { loadStripe } from '@stripe/stripe-js';

// This is the publishable key - it's safe to expose in the frontend
const stripePromise = loadStripe('pk_test_51S8e6YHnSTKmmIwR2aSbtHog8WNMpe69KLlF4LsNFuWsjazTKV4XCyTCDMR5BeTC6njQ7Xqe8tgniTv3mW0NRIvS00iuXka3W8');

export { stripePromise };