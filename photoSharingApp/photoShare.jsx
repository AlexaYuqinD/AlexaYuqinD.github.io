import React from 'react';
import ReactDOM from 'react-dom';
import {
  HashRouter, Route, Switch, Redirect
} from 'react-router-dom';
import {
  Grid, Typography, Paper
} from '@material-ui/core';
import './styles/main.css';

// import necessary components
import TopBar from './components/topBar/TopBar';
import UserDetail from './components/userDetail/UserDetail';
import UserList from './components/userList/UserList';
import UserPhotos from './components/userPhotos/UserPhotos';
import LoginRegister from './components/loginRegister/LoginRegister';
import Activities from './components/activities/Activities';
import axios from 'axios';


class PhotoShare extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      userId: undefined,
      firstName: undefined,
      userName: undefined,
      login: false,
      show: undefined,
      error: null,
      advanced: false,
      refreshed: false
    };
    this.showUser = this.showUser.bind(this);
    this.showPhoto = this.showPhoto.bind(this);
    this.showAdvanced = this.showAdvanced.bind(this);
    this.setLogin = this.setLogin.bind(this);
    this.setFirstName = this.setFirstName.bind(this);
    this.setUserId = this.setUserId.bind(this);
  }

  showUser(name) {
    this.setState({show: name});
  }

  showPhoto(name) {
    this.setState({show: 'Photos of ' + name});
  }

  showAdvanced(bool) {
    this.setState({advanced: bool});
  }

  setLogin(bool) {
    this.setState({login: bool});
  }

  setFirstName(name) {
    this.setState({firstName: name});
  }

  setUserId(id) {
    this.setState({userId: id});
  }

  componentDidMount() {
    var self = this;
    axios.get('/login/info')
      .then(function (response) {
        if (response.data === false) {
          self.setState({
            login: false,
            refreshed: !self.state.refreshed,
          });                   
        }
        else {
          console.log('test！！');
          self.setState({
            login: true,
            firstName: response.data.first_name,
            userName: response.data.login_name,
            userId: response.data.user_id,
            refreshed: !self.state.refreshed,
          });           
        }

      })
      .catch(function (error) {
          console.log(error);
          self.setState({
            error: error
          });
      });    
  }


  componentWillMount() {
    var self = this;
    axios.get('/test/info')
      .then(function (response) {
        self.setState({
          show: 'Version: ' + response.data.__v,
        });
      })
      .catch(function (error) {
          console.log(error);
          self.setState({
            error: error
          });
      });
  }

  render() {
    // console.log(this.state.login);
    // console.log(this.state.userId);
      return (
        <HashRouter>
        <div>
        <Grid container spacing={8}>
          <Grid item xs={12}>
            <TopBar login={this.state.login} show={this.state.show} showAdvanced={this.showAdvanced} 
              setLogin={this.setLogin} firstName={this.state.firstName} userId={this.state.userId} setUserId={this.setUserId} />
          </Grid>
          <div className="cs142-main-topbar-buffer"/>
          <Grid item sm={3}>
            <Paper  className="cs142-main-grid-item">
              <UserList advanced={this.state.advanced} logged={this.state.login} />
            </Paper>
          </Grid>
          <Grid item sm={9}>
            <Paper className="cs142-main-grid-item">
              <Switch>
              <Route exact path="/"
                  render={() => (
                    this.state.login ?
                    <Typography variant="body1">
                    Welcome to your photosharing app! This <a href="https://material-ui.com/demos/paper/">Paper</a> component
                    displays the main content of the application. The {"sm={9}"} prop in
                    the <a href="https://material-ui.com/layout/grid/">Grid</a> item component makes it responsively
                    display 9/12 of the window. The Switch component enables us to conditionally render different
                    components to this part of the screen. You don&apos;t need to display anything here on the homepage,
                    so you should delete this Route component once you get started.
                    </Typography>
                    : <Redirect to="/login-register" />
                  )}
                />
                <Route path="/users/:userId"
                  render={ (props) => (this.state.login ? 
                    <UserDetail showUser={this.showUser} key={props.match.params.userId + 'user'} logged={this.state.login} {...props} />
                    : <Redirect to="/login-register" />)}
                />
                <Route path="/photos/:userId"
                  render ={ (props) => (this.state.login ? 
                    <UserPhotos showPhoto={this.showPhoto} advanced={this.state.advanced} key={props.match.params.userId + 'photo'} logged={this.state.login} userId={this.state.userId} {...props} /> 
                    : <Redirect to="/login-register" />)}
                />
                <Route path="/users" 
                  render={(props) => (this.state.login ? 
                    <UserList logged={this.state.login} {...props} />
                    : <Redirect to="/login-register" />)} 
                />
                <Route path="/login-register" render={(props) => <LoginRegister setLogin={this.setLogin} setFirstName={this.setFirstName} setUserId={this.setUserId} logged={this.state.login} userId={this.state.userId} {...props} />} />
                <Route path="/activities" 
                  render={() => (this.state.login ? 
                    <Activities />
                    : <Redirect to="/login-register" />)} 
                />
              </Switch>
            </Paper>
          </Grid>
        </Grid>
        </div>
      </HashRouter>
      );
  }
}


ReactDOM.render(
  <PhotoShare />,
  document.getElementById('photoshareapp'),
);
