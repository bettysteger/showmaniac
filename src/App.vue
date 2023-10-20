<script setup>
import { RouterView } from 'vue-router'
import Search from './components/Search.vue';
import ShowModal from './views/ShowModal.vue';
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
          <a ng-if="_.authData.email.indexOf('@temp.com') > 0" ng-click="_.showEmailForm=!_.showEmailForm" class="navbar-link">
            Set email
          </a>
          <a ng-click="_.logout()" class="navbar-link">logout</a>
        </p>
        <ul class="nav navbar-nav navbar-right">
          <li ng-if="!_.authData"><a ng-click="_.loginForm=!_.loginForm">login / signup</a></li>
          <li ng-if="!_.authData"><a ng-click="_.oauth('facebook')">login with facebook</a></li>
          <li ng-if="_.authData"><a href=""></a></li>
        </ul> -->
        <form class="navbar-form navbar-right">
          <Search />
        </form>
      </div><!-- /.navbar-collapse -->
    </div><!-- /.container -->
  </nav>

  <RouterView />
  <ShowModal />
</template>
