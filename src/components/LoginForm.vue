<script setup>
import { ref } from 'vue'

const emit = defineEmits(['close'])
const email = ref('')
const password = ref('')
const error = ref('')
const isSignup = ref(false)

const props = defineProps({
  onLogin: {
    type: Function,
    required: true
  }
})

function getErrorMessage(error) {
  switch (error.code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address'
    case 'auth/user-disabled':
      return 'This account has been disabled'
    case 'auth/user-not-found':
      return 'No account found with this email'
    case 'auth/wrong-password':
      return 'Incorrect password'
    case 'auth/email-already-in-use':
      return 'An account already exists with this email'
    case 'auth/weak-password':
      return 'Password should be at least 6 characters'
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection'
    default:
      return error.message || 'An error occurred. Please try again'
  }
}

async function handleSubmit() {
  error.value = ''

  if (!email.value || !password.value) {
    error.value = 'Please fill in all fields'
    return
  }

  try {
    await props.onLogin(email.value, password.value)
    emit('close')
  } catch (err) {
    error.value = getErrorMessage(err)
    // Clear password on error for security
    if (err.code === 'auth/wrong-password') {
      password.value = ''
    }
  }
}
</script>

<template>
  <div class="modal fade in show">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <button type="button" class="close" @click="emit('close')">&times;</button>
          <h4 class="modal-title">{{ isSignup ? 'Sign Up' : 'Login' }}</h4>
        </div>
        <div class="modal-body">
          <form @submit.prevent="handleSubmit">
            <div class="form-group" :class="{'has-error': error}">
              <label for="email">Email</label>
              <input type="email"
                     class="form-control"
                     id="email"
                     v-model="email"
                     placeholder="Enter email"
                     autocomplete="email">
            </div>
            <div class="form-group" :class="{'has-error': error}">
              <label for="password">Password</label>
              <input type="password"
                     class="form-control"
                     id="password"
                     v-model="password"
                     placeholder="Password"
                     autocomplete="current-password">
            </div>
            <div v-if="error" class="alert alert-danger">
              {{ error }}
            </div>
            <div class="text-center">
              <button type="submit" class="btn btn-success">
                {{ isSignup ? 'Sign Up' : 'Login' }}
              </button>
              <p class="help-block">
                {{ isSignup ? 'Already have an account?' : "Don't have an account?" }}
                <a href="#" @click.prevent="isSignup = !isSignup; error = ''">
                  {{ isSignup ? 'Login' : 'Sign up' }}
                </a>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
  <div class="modal-backdrop fade in"></div>
</template>

<style scoped>
.alert {
  margin-top: 15px;
}
</style>