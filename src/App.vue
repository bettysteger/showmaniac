<script setup>
import { ref } from 'vue'
import { RouterView } from 'vue-router'
import Search from './components/Search.vue';
import ShowModal from './views/ShowModal.vue';

const seen1 = ref(false)
const seen2 = ref(true)
const seen3 = ref(false)
</script>

<template>
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
        <!-- <p ng-if="_.authData" class="navbar-text navbar-right" ng-cloak>
          {{ _.authData.providerData[0].displayName || _.authData.email.replace('@temp.com', '') }} &nbsp;
          <a ng-if="_.authData.email.indexOf('@temp.com') > 0" @click="_.showEmailForm=!_.showEmailForm" class="navbar-link">
            Set email
          </a>
          <a @click="_.logout()" class="navbar-link">logout</a>
        </p>
        <ul class="nav navbar-nav navbar-right">
          <li ng-if="!_.authData"><a @click="_.loginForm=!_.loginForm">login / signup</a></li>
          <li ng-if="!_.authData"><a @click="_.oauth('facebook')">login with facebook</a></li>
          <li ng-if="_.authData"><a href=""></a></li>
        </ul> -->
        <form class="navbar-form navbar-right">
          <Search />
        </form>
      </div><!-- /.navbar-collapse -->
    </div><!-- /.container -->
  </nav>

  <RouterView />

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
