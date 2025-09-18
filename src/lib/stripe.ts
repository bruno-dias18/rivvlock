import { loadStripe } from '@stripe/stripe-js';

// This is the publishable key - it's safe to expose in the frontend
const stripePromise = loadStripe('pk_test_51QhWfSDAhjKfgBL5xT8fcZlhIqFOLjbT9eVBQl4JJLUhSwzjKczJHtjmsL7UYq6olo0GhlbfxPP1rMRZHZZxjz0D00nCc3kgLi');

export { stripePromise };