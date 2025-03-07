<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterView } from 'vue-router'
import { auth } from './firebase/config'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  FacebookAuthProvider,
  signOut,
  onAuthStateChanged
} from 'firebase/auth'
import Search from './components/Search.vue';
import ShowModal from './views/ShowModal.vue';
import LoginForm from './components/LoginForm.vue';
import LoadingSpinner from './components/LoadingSpinner.vue'

const seen1 = ref(false)
const seen2 = ref(true)
const seen3 = ref(false)

// Auth state
const user = ref(null)
const showLoginForm = ref(false)
const showEmailForm = ref(false)

// Auth methods
const handleAuth = async (email, password) => {
  if (showLoginForm.value && !showEmailForm.value) {
    await signInWithEmailAndPassword(auth, email, password)
  } else {
    await createUserWithEmailAndPassword(auth, email, password)
  }
  showLoginForm.value = false
}

const loginWithFacebook = async () => {
  try {
    const provider = new FacebookAuthProvider()
    await signInWithPopup(auth, provider)
  } catch (error) {
    console.error('Facebook login error:', error)
  }
}

const logout = async () => {
  try {
    await signOut(auth)
  } catch (error) {
    console.error('Logout error:', error)
  }
}

// Listen to auth state changes
onMounted(() => {
  const unsubscribe = onAuthStateChanged(auth, (userData) => {
    console.log('Auth state changed:', userData ? 'logged in' : 'logged out')
    user.value = userData
  })

  // Cleanup subscription on component unmount
  onUnmounted(() => unsubscribe())
})
</script>

<template>
  <LoadingSpinner />

  <nav class="navbar navbar-inverse navbar-fixed-top">
    <div class="container">
      <!-- Brand and toggle get grouped for better mobile display -->
      <div class="navbar-header">
        <button type="button" class="navbar-toggle collapsed" data-toggle="collapse" data-target="#navbar-collapse" aria-expanded="false">
          <span class="sr-only">Toggle navigation</span>
          <span class="icon-bar"></span>
          <span class="icon-bar"></span>
          <span class="icon-bar"></span>
        </button>
        <a class="navbar-brand" href="/"><img src="/images/logo.png" alt="showmaniac"></a>
      </div>

      <div class="collapse navbar-collapse" id="navbar-collapse">
        <p v-if="user" class="navbar-text navbar-right">
          {{ user.providerData[0].displayName || user.email?.replace('@temp.com', '') }} &nbsp;
          <a v-if="user.email?.includes('@temp.com')"
             href="#"
             @click.prevent="showEmailForm = !showEmailForm"
             class="navbar-link">
            Set email
          </a>
          <a href="#" @click.prevent="logout" class="navbar-link">logout</a>
        </p>
        <ul v-else class="nav navbar-nav navbar-right">
          <li><a href="#" @click.prevent="showLoginForm = !showLoginForm">login / signup</a></li>
          <li><a href="#" @click.prevent="loginWithFacebook">login with facebook</a></li>
        </ul>
        <form class="navbar-form navbar-right">
          <Search />
        </form>
      </div><!-- /.navbar-collapse -->
    </div><!-- /.container -->
  </nav>

  <RouterView />

  <LoginForm v-if="showLoginForm" :onLogin="handleAuth" @close="showLoginForm = false" />

  <p>&nbsp;</p>

  <div class="row">
    <div class="col-md-7">

      <hr class="gap hidden-xs">

      <h1>Latest air dates only</h1>
      <h3>Shows the previous and next air date of your added TV shows<br>in your local time</h3>
<!--           <p>&nbsp;</p>
  <h2>In your local time</h2>
  <h4>TV shows are produced in US, UK, etc = different timezones!</h4> -->
      <!-- <br>Always know when the latest episode aired -->

      <p>&nbsp;</p>
      <p>&nbsp;</p>

      <div class="row">
        <div class="col-sm-9">
          <Search size="lg" />
        </div>
      </div>

      <!-- or <a class="btn btn-success">Android</a> -->
    </div>
    <div class="col-md-4 col-md-offset-1">

      <div class="text-center">
        <img src="/images/icon.png" alt="Showmaniac Logo">
      </div>
      <p>&nbsp;</p>

      <div class="greenbg row"></div>
      <div class="tvshow row" :class="{seen:seen1}"> <div class="col-xs-10"> <h4>The Big Bang Theory</h4> <p> 26 Sep 2017 02:00 &nbsp; <b> <a ng-href="http://google.com/search?q=The Big Bang Theory 11x01" target="_blank" rel="noopener" href="http://google.com/search?q=The Big Bang Theory 11x01">11x01</a> </b> </p> </div> <div class="col-xs-2 text-right"> <i @click="seen1=!seen1" title="seen?" class="fa fa-check-circle" :class="{green:seen1}"></i> </div> </div><div class="tvshow row" :class="{seen:seen2}"> <div class="col-xs-10"> <h4>Game of Thrones</h4> <p> 28 Aug 2017 03:00 &nbsp; <b> <a ng-href="http://google.com/search?q=Game of Thrones 07x07" target="_blank" rel="noopener" href="http://google.com/search?q=Game of Thrones 07x07">07x07</a> </b> </p> </div> <div class="col-xs-2 text-right"> <i @click="seen2=!seen2" title="seen?" class="fa fa-check-circle" :class="{green:seen2}"></i> </div> </div><div class="tvshow row" :class="{seen:seen3}"> <div class="col-xs-10"> <h4>Sherlock</h4> <p> 15 Jan 2017 22:00 &nbsp; <b> <a ng-href="http://google.com/search?q=Sherlock 04x03" target="_blank" rel="noopener" href="http://google.com/search?q=Sherlock 04x03">04x03</a> </b> </p> </div> <div class="col-xs-2 text-right"> <i @click="seen3=!seen3" title="seen?" class="fa fa-check-circle" :class="{green:seen3}"></i> </div> </div>
    </div>
  </div>
  <ShowModal />
</template>
