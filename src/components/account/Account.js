import React, {Component, Fragment} from 'react';
import {t, tu} from "../../utils/i18n";
import {transactionResultManager} from "../../utils/tron";
import xhr from "axios";
import {FormattedDate, FormattedNumber, FormattedRelative, FormattedTime, injectIntl} from "react-intl";
import {Link} from "react-router-dom";
import {TRXPrice} from "../common/Price";
import {SwitchToken} from "../common/Switch";
import FreezeBalanceModal from "./FreezeBalanceModal";
import {AddressLink, HrefLink, TokenLink, TokenTRC20Link} from "../common/Links";
import SweetAlert from "react-bootstrap-sweetalert";
import {API_URL, IS_TESTNET, ONE_TRX, CONTRACT_ADDRESS_USDT, CONTRACT_ADDRESS_WIN, CONTRACT_ADDRESS_GGC} from "../../constants";
import {Client} from "../../services/api";
import ApplyForDelegate from "./ApplyForDelegate";
import _, {trim} from "lodash";
import {Modal, ModalBody, ModalHeader} from "reactstrap";
import QRImageCode from "../common/QRImageCode";
import ChangeNameModal from "./ChangeNameModal";
import CreateTxnPairModal from "./CreateTxnPairModal";
import OperateTxnPairModal from "./OperateTxnPairModal";
import {addDays, getTime} from "date-fns";
import TestNetRequest from "./TestNetRequest";
import Transactions from "../common/Transactions";
import {decode58Check, pkToAddress} from "@tronscan/client/src/utils/crypto";
import {QuestionMark} from "../common/QuestionMark";
import Lockr from "lockr";
import {withTronWeb} from "../../utils/tronWeb";
import {login} from "../../actions/app";
import {loadRecentTransactions} from "../../actions/account";
import {reloadWallet} from "../../actions/wallet";
import {connect} from "react-redux";
import {CopyToClipboard} from "react-copy-to-clipboard";
import QRCode from "qrcode.react";
import {byteArray2hexStr} from "@tronscan/client/src/utils/bytes";
import { FormatNumberByDecimals } from '../../utils/number'
import { getQueryString } from "../../utils/url";
import IssuedToken from './IssuedToken'

@connect(
    state => {
      return {
      account: state.app.account,
      walletType: state.app.wallet,
      tokenBalances: state.account.tokens,
      tokens20: state.account.tokens20,
      totalTransactions: state.account.totalTransactions,
      frozen: state.account.frozen,
      accountResource: state.account.accountResource,
      delegated: state.account.delegated,
      wallet: state.wallet,
      currentWallet: state.wallet.current,
      trxBalance: state.account.trxBalance,
    }},
    {
      login,
      loadRecentTransactions,
      reloadWallet,
    }
)
@injectIntl
@withTronWeb
export default class Account extends Component {
  constructor() {
    super();
    this.state = {
      modal: null,
      showFreezeBalance: false,
      showBuyTokens: false,
      sr: null,
      issuedAsset: null,
      showBandwidth: false,
      privateKey: "",
      temporaryName: "",
      selectedResource: null,
      hideSmallCurrency: false,
      tokenTRC10: true,
      tokens20: [],
      dealPairTrxLimit: 100000,
      isTronLink: 0,
      delegateType: 0,
      delegate: false,
      delegateValue: ''
    };

  }

  componentDidMount() {

    let {account,match} = this.props;


    if (account.isLoggedIn) {
      this.setState({isTronLink: Lockr.get("islogin")});
      this.reloadTokens();
      this.loadAccount();
      if(getQueryString('from') == 'tronlink' && getQueryString('type') == 'frozen'){
          setTimeout(()=>{
              this.scrollToAnchor()
          },3000)
      }
    }
  }

  componentDidUpdate(prevProps) {
    let {account} = this.props;
    if (((prevProps.account.isLoggedIn !== account.isLoggedIn) && account.isLoggedIn) || ((prevProps.account.address !== account.address) && account.isLoggedIn)) {
      this.setState({isTronLink: Lockr.get("islogin")});
      this.reloadTokens();
      this.loadAccount();
      //this.getTRC20Tokens();
    }
  }


  scrollToAnchor = () => {

      let anchorElement = document.getElementById('tronPower');
      if(anchorElement) { anchorElement.scrollIntoView(); }

  }

  loadAccount = async () => {
    let {account, loadRecentTransactions, currentWallet} = this.props;
    loadRecentTransactions(account.address);
    this.setState({
      issuedAsset: null,
      sr: null,
    });

    if (currentWallet && currentWallet.representative.enabled) {
      let sr = await Client.getSuperRepresentative(currentWallet.address);
      this.setState({
        sr,
      });
    }

    const {token} =  await Client.getIssuedAsset(account.address)

    if(token){
      const { rangeTotal } = await Client.getAssetTransfers({limit: 0, start: 0, issueAddress: account.address})
      token.rangeTotal =  rangeTotal
      this.setState({
        issuedAsset: token,
      });
    }
    

    // if (currentWallet && currentWallet.allowExchange.length) {
    //     let {data,total} = await Client.getExchangesList({'address':currentWallet.address});
    //     this.setState({
    //         exchangesList: data,
    //     });
    //
    // }
  };

  reloadTokens = () => {
    this.props.reloadWallet();
  };


  async getTRC20Tokens() {
    let {account} = this.props;
    let result = await xhr.get(API_URL + "/api/token_trc20?sort=issue_time&start=0&limit=50");
    let tokens20 = result.data.trc20_tokens;
    const tronWebLedger = this.props.tronWeb();
    const {tronWeb} = this.props.account;
    if (this.props.walletType.type === "ACCOUNT_LEDGER") {
      tokens20 && tokens20.map(async item => {
        item.token20_name = item.name + '(' + item.symbol + ')';

        let contractInstance = await tronWebLedger.contract().at(item.contract_address);
        let balanceData = await contractInstance.balanceOf(this.props.walletType.address).call();
        if (balanceData.balance) {
          item.token20_balance = parseFloat(balanceData.balance.toString()) / Math.pow(10, item.decimals);
        } else {
          item.token20_balance = parseFloat(balanceData.toString()) / Math.pow(10, item.decimals);
        }
        return item
      });
      this.setState({
        tokens20: tokens20
      });
    }
    if (this.props.walletType.type === "ACCOUNT_TRONLINK" || this.props.walletType.type === "ACCOUNT_PRIVATE_KEY") {
      tokens20 && tokens20.map(async item => {
        item.token20_name = item.name + '(' + item.symbol + ')';
        let contractInstance = await tronWeb.contract().at(item.contract_address);
        let balanceData = await contractInstance.balanceOf(account.address).call();
        if (balanceData.balance) {
          //item.token20_balance = parseFloat(balanceData.balance.toString()) / Math.pow(10, item.decimals);
            item.token20_balance = FormatNumberByDecimals(balanceData.balance.toString() , item.decimals);
        } else {
            item.token20_balance = FormatNumberByDecimals(balanceData.toString() , item.decimals);
         // item.token20_balance = FormatNumberByDecimals(balanceData.toString() , item.decimals)

        }
        return item
      });
      this.setState({
        tokens20: tokens20
      });
    }


  }

  renderTRC20Tokens() {
    let { hideSmallCurrency } = this.state;
    let { tokens20 } = this.props;
    if (hideSmallCurrency) {
      tokens20 = _(tokens20)
          .filter(tb => tb.token20_balance_decimals >= 10)
          .sortBy(tb => -tb.token20_balance_decimals)
          .value();
    } else {
      tokens20 = _(tokens20)
          .filter(tb => tb.token20_balance_decimals > 0)
          .sortBy(tb => -tb.token20_balance_decimals)
          .value();
    }
    // for (let token of tokens20) {
    //     token.token20Balance = toThousands(token.token20_balance);
    // }

    if (tokens20.length === 0) {
      return (
          <div className="text-center d-flex justify-content-center p-4">
            {tu("no_tokens")}
          </div>
      );
    }
    return (
        <table className="table mt-3 temp-table">
          <thead className="thead-light">
          <tr>
            <th>{tu("name")}</th>
            <th className="text-right">{tu("balance")}</th>
          </tr>
          </thead>
          <tbody>
          {
            tokens20.map((token) => (
                <tr key={token.token20_name}>
                  <td className="text-nowrap">

                      {
                          token.contract_address == CONTRACT_ADDRESS_USDT || token.contract_address == CONTRACT_ADDRESS_WIN  || token.contract_address ==CONTRACT_ADDRESS_GGC?<div className="map-token-top">
                            <TokenTRC20Link name={token.name} address={token.contract_address}
                                            namePlus={token.name + ' (' + token.symbol + ')'}/>
                            <i></i>
                            </div>:<TokenTRC20Link name={token.name} address={token.contract_address}
                                                   namePlus={token.name + ' (' + token.symbol + ')'}/>
                      }
                  </td>
                  <td className="text-right">
                    <span>{token.token20_balance}</span>
                    {/*<FormattedNumber value={token.token20_balance} maximumFractionDigits={20}/>*/}
                  </td>
                </tr>
            ))
          }
          </tbody>
        </table>
    )
  }

  renderTokens() {
    let {hideSmallCurrency} = this.state;
    let {tokenBalances = []} = this.props;
    if (hideSmallCurrency) {
      tokenBalances = _(tokenBalances)
          .filter(tb => tb.name.toUpperCase() !== "_")
          .filter(tb => tb.map_amount >= 10)
          .value();
    } else {
      tokenBalances = _(tokenBalances)
          .filter(tb => tb.name.toUpperCase() !== "_")
          .filter(tb => tb.map_amount > 0)
          .value();
    }
    if (tokenBalances.length === 0) {
      return (
          <div className="text-center d-flex justify-content-center p-4">
            {tu("no_tokens")}
          </div>
      );
    }

    return (
        <table className="table mt-3 temp-table">
          <thead className="thead-light">
          <tr>
            <th width="40%">{tu("name")}</th>
            <th>ID</th>
            <th>{tu("TRC20_decimals")}</th>
            <th className="text-right">{tu("balance")}</th>
          </tr>
          </thead>
          <tbody>
          {
            tokenBalances.map((token) => (
                <tr key={token.name}>
                  <td className="text-nowrap">
                      {
                          token.map_token_id == 1002000?<div className="map-token-top">
                            <TokenLink id={token.map_token_id} name={token.map_token_name+' ('+token.map_token_name_abbr+")"} address={token.address}/>
                            <i></i>
                          </div>: <TokenLink id={token.map_token_id} name={token.map_token_name+' ('+token.map_token_name_abbr+")"} address={token.address}/>
                      }

                  </td>
                  <td>
                    <div className="tokenBalances_id">{token.map_token_id}</div>
                  </td>
                  <td>
                    <div>{token.map_token_precision}</div>
                  </td>
                  <td className="text-right">
                    <FormattedNumber value={token.map_amount}
                                     maximumFractionDigits={Number(token.map_token_precision)}/>
                  </td>
                </tr>
            ))
          }
          </tbody>
        </table>
    )
  }

  renderBandwidth() {

    let {currentWallet} = this.props;

    return (
        <div className="row mt-3">
          <div className="col-md-12">
            <div className="card">
              <div className="card-body px-0 border-0">
                <h5 className="card-title text-center m-0">
                  {tu("bandwidth")}
                </h5>
              </div>
              <table className="table m-0">
                <tbody>
                <tr>
                  <th style={{width: 200}}>{tu("free_bandwidth")}</th>
                  <td>
                    <span className="text-primary">
                      <FormattedNumber value={currentWallet.bandwidth.freeNetUsed} className="text-success"/>&nbsp;
                    </span>/&nbsp;
                    <span className="text-muted">
                      <FormattedNumber value={currentWallet.bandwidth.freeNetLimit}/>
                    </span>
                    <span className="float-right">
                      {Math.ceil(currentWallet.bandwidth.freeNetPercentage)}%
                    </span>
                    <div className="progress mt-1">
                      <div className="progress-bar bg-primary"
                           style={{width: currentWallet.bandwidth.freeNetPercentage + '%'}}/>
                    </div>
                  </td>
                </tr>
                <tr>
                  <th style={{width: 200}}>{tu("bandwidth")}</th>
                  <td>
                    <span className="text-primary">
                      <FormattedNumber value={currentWallet.bandwidth.netUsed} className="text-primary"/>&nbsp;
                    </span>/&nbsp;
                    <span className="text-muted">
                      <FormattedNumber value={currentWallet.bandwidth.netLimit}/>
                    </span>
                    <span className="float-right">
                      {Math.ceil(currentWallet.bandwidth.netPercentage)}%
                    </span>
                    <div className="progress mt-1">
                      <div className="progress-bar bg-primary"
                           style={{width: currentWallet.bandwidth.netPercentage + '%'}}/>
                    </div>
                  </td>
                </tr>
                {
                  Object.keys(currentWallet.bandwidth.assets).length > 0 &&
                  <tr>
                    <td className="bg-light text-center" colSpan={2}>
                      Tokens
                    </td>
                  </tr>
                }
                {
                  Object.entries(currentWallet.bandwidth.assets).map(([token, bandwidth]) => (
                      <tr>
                        <th style={{width: 200}}>{token}</th>
                        <td>
                        <span className="text-primary">
                          <FormattedNumber value={bandwidth.netUsed} className="text-primary"/>&nbsp;
                        </span>
                          /&nbsp;
                          <span className="text-muted">
                          <FormattedNumber value={bandwidth.netLimit}/>
                        </span>
                          <span className="float-right">
                          {Math.ceil(bandwidth.netPercentage)}%
                        </span>
                          <div className="progress mt-1">
                            <div className="progress-bar bg-primary" style={{width: bandwidth.netPercentage + '%'}}/>
                          </div>
                        </td>
                      </tr>
                  ))
                }
                </tbody>
              </table>
            </div>
          </div>
        </div>
    );
  }

  renderFrozenTokens() {

    let {frozen, accountResource, delegated,  account} = this.props;

    let receiveDelegateBandwidth = 0;
    if(delegated&&delegated.receivedDelegatedBandwidth) {
      for (let i = 0; i < delegated.receivedDelegatedBandwidth.length; i++) {
        receiveDelegateBandwidth = receiveDelegateBandwidth + delegated.receivedDelegatedBandwidth[i]['frozen_balance_for_bandwidth'];
      }
    }

    let frozenBandwidth=0;
    if(frozen.balances.length > 0){
      frozenBandwidth=frozen.balances[0].amount;
    }

    let receiveDelegateResource=0;
    if(delegated&&delegated.receivedDelegatedResource) {
      for (let i = 0; i < delegated.receivedDelegatedResource.length; i++) {
        receiveDelegateResource = receiveDelegateResource + delegated.receivedDelegatedResource[i]['frozen_balance_for_energy'];
      }
    }

    let frozenEnergy=0;
    if(accountResource.frozen_balance > 0){
      frozenEnergy=accountResource.frozen_balance;
    }

    if (frozenEnergy === 0 && frozenBandwidth===0 && receiveDelegateBandwidth===0 && receiveDelegateResource===0) {
      return null;
    }

    return (

        <div style={{overflow:'auto'}}>
        <h5>{tu("my_account")}</h5>
        <table className="table m-0 temp-table">
          <thead className="thead-light">
          <tr>
            <th>{tu("freeze_type")}</th>
            <th>{tu("delegate_other")}</th>
            <th>{tu("freeze_self")}</th>
            <th>{tu("total_amount")}</th>
            <th className="text-right">{tu("unfreeze_time")}</th>
            <th></th>
          </tr>
          </thead>
          <tbody>
          {
            (frozen.balances.length > 0 || (delegated&&delegated.receivedDelegatedBandwidth&&delegated.receivedDelegatedBandwidth.length >0)) && <tr>
              <td>
                {tu('bandwidth')}
              </td>
              <td>
                <TRXPrice amount={receiveDelegateBandwidth / ONE_TRX}/>
              </td>
              <td>
                <TRXPrice amount={frozenBandwidth / ONE_TRX}/>
              </td>
              <td>
                <TRXPrice amount={(receiveDelegateBandwidth+frozenBandwidth) / ONE_TRX}/>
              </td>
              {frozen.balances.length > 0 ? <td className="text-right">
                <span className="mr-1">{tu('After')}</span>
                <FormattedDate value={frozen.balances[0].expires}/>&nbsp;
                <FormattedTime value={frozen.balances[0].expires}  hour='numeric' minute="numeric" second='numeric' hour12={false}/>
              </td>:<td></td>}
              <td className="text-right">

                  {
                    frozenBandwidth!==0 && <button className="btn btn-danger mr-2" style={{marginTop: '-5px',
                      marginBottom: '-5px'}} onClick={() => {
                      this.showUnfreezeModal(0, false, '')
                    }}>
                      {tu("unfreeze")}
                    </button>
                  }

              </td>
            </tr>
          }
          {
            (accountResource.frozen_balance > 0 || (delegated&&delegated.receivedDelegatedResource&&delegated.receivedDelegatedResource.length >0))&& <tr>
              <td>
                {tu('energy')}
              </td>
              <td>
                <TRXPrice amount={receiveDelegateResource / ONE_TRX}/>
              </td>
              <td>
                <TRXPrice amount={frozenEnergy / ONE_TRX}/>
              </td>
              <td>
                <TRXPrice amount={(frozenEnergy+receiveDelegateResource) / ONE_TRX}/>
              </td>
              {accountResource.frozen_balance > 0?<td className="text-right">
                <span className="mr-1">{tu('After')}</span>
                <FormattedDate value={accountResource.expire_time}/>&nbsp;
                <FormattedTime value={accountResource.expire_time}  hour='numeric' minute="numeric" second='numeric' hour12={false}/>
              </td>:<td></td>
              }
              <td className="text-right">
                {
                  frozenEnergy!==0 && <button className="btn btn-danger mr-2" style={{marginTop: '-5px',
                    marginBottom: '-5px'}} onClick={() => {
                    this.showUnfreezeModal(1, false, '')
                  }}>
                    {tu("unfreeze")}
                  </button>
                }
              </td>
            </tr>
          }
          </tbody>
        </table>
        </div>
    )
  }

  renderDelegateFrozenTokens() {

    let {frozen, accountResource, account, delegated} = this.props;
    if (!delegated||((delegated&&delegated.sentDelegatedBandwidth&&delegated.sentDelegatedBandwidth.length===0)&&(delegated&&delegated.sentDelegatedResource&&delegated.sentDelegatedResource.length===0))) {
      return null;
    }

    return (
        <div style={{overflow:'auto'}}>
        <h5 style={{marginTop: '10px'}}>{tu("delegate_list")}</h5>
        <table className="table m-0 temp-table">
          <thead className="thead-light">
          <tr>
            <th>{tu('receive_list')}</th>
            <th>{tu('type')}</th>
            <th>{tu('amount')}</th>
            <th className="text-right">{tu("unfreeze_time")}</th>
            <th></th>
          </tr>
          </thead>
          <tbody>
          {
            delegated&&delegated.sentDelegatedBandwidth&&delegated.sentDelegatedBandwidth.map((item,index)=>{
              return <tr key={index}>
                <td>
                  <AddressLink address={item.to} truncate={false}>
                    <span className="color-tron-100">{item.to}</span>
                  </AddressLink>
                </td>
                <td>
                  {tu('bandwidth')}
                </td>
                <td>
                  <TRXPrice amount={item.frozen_balance_for_bandwidth / ONE_TRX}/>
                </td>
                <td className="text-right">
                  <span className="mr-1">{tu('After')}</span>
                  <FormattedDate value={item.expire_time_for_bandwidth}/>&nbsp;
                  <FormattedTime value={item.expire_time_for_bandwidth}  hour='numeric' minute="numeric" second='numeric' hour12={false}/>
                </td>
                  <td className="text-right">
                    {
                      <button className="btn btn-danger mr-2"  style={{
                        marginTop: '-5px',
                        marginBottom: '-5px'
                      }} onClick={() => {
                        this.showUnfreezeModal(0, true, item.to)
                      }}>
                        {tu("unfreeze")}
                      </button>
                    }
                  </td>
              </tr>
            })
          }
          {
            delegated&&delegated.sentDelegatedResource&&delegated.sentDelegatedResource.map((item,index)=>{
              return <tr key={index}>
                <td>
                  <AddressLink address={item.to} truncate={false}>
                    <span className="color-tron-100">{item.to}</span>
                  </AddressLink>
                </td>
                <td>
                  {tu('energy')}
                </td>
                <td>
                  <TRXPrice amount={item.frozen_balance_for_energy / ONE_TRX}/>
                </td>
                <td className="text-right">
                  <span className="mr-1">{tu('After')}</span>
                  <FormattedDate value={item.expire_time_for_energy}/>&nbsp;
                  <FormattedTime value={item.expire_time_for_energy}  hour='numeric' minute="numeric" second='numeric' hour12={false}/>
                </td>
                <td className="text-right">
                  {
                    <button className="btn btn-danger mr-2" style={{marginTop: '-5px',
                      marginBottom: '-5px'}} onClick={() => {
                      this.showUnfreezeModal(1, true, item.to)
                    }}>
                      {tu("unfreeze")}
                    </button>
                  }
                </td>
              </tr>
            })

          }
          </tbody>
        </table>
        </div>
    )
  }

  renderTransactions() {

    let {currentWallet} = this.props;
    return (
        <Transactions
            theadClass="thead-light"
            showTotal={false}
            autoRefresh={30000}
            pagingProps={{showPageSize: false}}
            EmptyState={() => <p className="text-center">No transactions yet</p>}
            filter={{address: currentWallet.address}}
            page={{router:'account'}}
        />
    )
  }

  onInputChange = (value) => {
    let {account} = this.props;
    if (value && value.length === 64) {
      this.privateKey.className = "form-control";
      if (pkToAddress(value) !== account.address)
        this.privateKey.className = "form-control is-invalid";
    }
    else {
      this.privateKey.className = "form-control is-invalid";
    }
    this.setState({privateKey: value})
    this.privateKey.value = value;
  }
  confirmPrivateKey = (param) => {
    let {privateKey} = this.state;
    let {account} = this.props;

    let confirm = null;
    if (param === 'freeze')
      confirm = this.showFreezeBalance;
    if (param === 'unfreeze')
      confirm = this.showUnfreezeModal;
    if (param === 'applySR')
      confirm = this.applyForDelegate;
    if (param === 'claimRewards')
      confirm = this.claimRewards;
    if (param === 'unfreezeAssetsConfirmation')
      confirm = this.unfreezeAssetsConfirmation;
    if (param === 'changeName')
      confirm = this.changeName;
    if (param === 'changeWebsite')
      confirm = this.changeWebsite;
    if (param === 'changeGithubURL')
      confirm = this.changeGithubURL;


    let reConfirm = () => {
      if (this.privateKey.value && this.privateKey.value.length === 64) {
        if (pkToAddress(this.privateKey.value) === account.address)
          confirm();
      }
    }

    this.setState({
      modal: (
          <SweetAlert
              info
              showCancel
              cancelBtnText={tu("cancel")}
              confirmBtnText={tu("confirm")}
              confirmBtnBsStyle="success"
              cancelBtnBsStyle="default"
              title={tu("confirm_private_key")}
              onConfirm={reConfirm}
              onCancel={this.hideModal}
              style={{marginLeft: '-240px', marginTop: '-195px'}}
          >
            <div className="form-group">
              <div className="input-group mb-3">
                <input type="text"
                       ref={ref => this.privateKey = ref}
                       onChange={(ev) => {
                         this.onInputChange(ev.target.value)
                       }}
                       className="form-control is-invalid"
                />
                <div className="invalid-feedback">
                  {tu("fill_a_valid_private_key")}
                </div>
              </div>
            </div>
          </SweetAlert>
      )
    });
  }
  showFreezeBalance = () => {

    let {privateKey} = this.state;

    let {trxBalance, currentWallet} = this.props;
    if (trxBalance === 0) {
      this.setState({
        modal: (
            <SweetAlert warning title={tu("not_enough_trx")} onConfirm={this.hideModal}>
              {tu("freeze_trx_least")}
            </SweetAlert>
        )
      });
      return;
    }


    this.setState({
      modal: (
          <FreezeBalanceModal
              frozenTrx={currentWallet.frozenTrx}
              privateKey={privateKey}
              onHide={this.hideModal}
              onError={() => {
                this.setState({
                  modal: (
                      <SweetAlert warning title={tu("Error")} onConfirm={this.hideModal}>
                        Something went wrong while trying to freeze TRX
                      </SweetAlert>
                  )
                });
              }}
              onConfirm={({amount}) => this.showFreezeConfirmation(amount)}
          />
      )
    });
  };
  resourceSelectChange = (value) => {
    this.setState({
      selectedResource: Number(value)
    });
  }

  hideModal = () => {
    this.setState({
      modal: null,
    });
  };

  hideFreezeModal = () => {
    this.setState({
      modal: null,
      selectedResource: null
    });
  }

  showUnfreezeModal = async (delegateType, delegate, delegateValue) => {
    this.setState({delegateType:delegateType, delegate:delegate, delegateValue:delegateValue});
    let {privateKey, selectedResource, resources} = this.state;
    let {intl} = this.props;
    this.setState({
      modal: (
          <SweetAlert
              info
              showCancel
              confirmBtnText={tu("unfreeze")}
              confirmBtnBsStyle="danger"
              cancelBtnBsStyle="default"
              cancelBtnText={tu("cancel")}
              title={tu("unfreeze_trx_confirm_message")}
              onConfirm={this.unfreeze}
              onCancel={this.hideFreezeModal}
              style={{height: '300px'}}
          >
            <div className="form-group" style={{marginBottom: '36px'}}>
              <div className="mt-3 mb-2 text-left" style={{color: '#666'}}>

              </div>
            </div>

          </SweetAlert>
      ),

    })
  };

  unfreezeAssetsConfirmation = async () => {
    this.setState({
      modal: (
          <SweetAlert
              info
              showCancel
              confirmBtnText={tu("unfreeze_assets")}
              confirmBtnBsStyle="danger"
              cancelBtnBsStyle="default"
              cancelBtnText={tu("cancel")}
              title={tu("sure_to_unfreeze_unlocked_tokens_message")}
              onConfirm={this.unfreezeAssets}
              onCancel={this.hideModal}
          >
          </SweetAlert>
      )
    })
  };

  claimRewards = async () => {
    let res;
    let {account, currentWallet} = this.props;
    if (this.state.isTronLink === 1) {
      let tronWeb;
      if (this.props.walletType.type === "ACCOUNT_LEDGER") {
        tronWeb = this.props.tronWeb();
      } else if (this.props.walletType.type === "ACCOUNT_TRONLINK") {
        tronWeb = account.tronWeb;
      }
      const unSignTransaction = await tronWeb.transactionBuilder.withdrawBlockRewards(tronWeb.defaultAddress.base58).catch(e => false);
      const {result} = await transactionResultManager(unSignTransaction, tronWeb)
      res = result;
    } else {
      let {success, code} = await Client.withdrawBalance(currentWallet.address)(account.key);
      res = success;
    }
    if (res) {
      this.setState({
        modal: (
            <SweetAlert success title={tu("rewards_claimed")} onConfirm={this.hideModal}>
              {tu("successfully_claimed_rewards")}
            </SweetAlert>
        )
      });
    } else {
      this.setState({
        modal: (
            <SweetAlert danger title={tu("could_not_claim_rewards")} onConfirm={this.hideModal}>
              {tu("claim_rewards_error_message")}
            </SweetAlert>
        )
      });
    }
  };

  unfreeze = async () => {
    let {delegateType, delegate, delegateValue}=this.state;
    let {account, walletType} = this.props;
    let {privateKey} = this.state;
    let res;
    this.hideModal();
    if (Lockr.get("islogin") || this.props.walletType.type === "ACCOUNT_LEDGER" || this.props.walletType.type === "ACCOUNT_TRONLINK") {
      const tronWebLedger = this.props.tronWeb();


      const {tronWeb} = this.props.account;

      if (!delegateType) {
        delegateType = 'BANDWIDTH';
      } else {
        delegateType = 'ENERGY';
      }

      try {
        if (this.props.walletType.type === "ACCOUNT_LEDGER") {
          let unSignTransaction;
          if(!delegate) {
             unSignTransaction = await tronWebLedger.transactionBuilder.unfreezeBalance(delegateType, walletType.address).catch(e => false);
          }else{
             unSignTransaction = await tronWebLedger.transactionBuilder.unfreezeBalance(delegateType, walletType.address, delegateValue).catch(e => false);
          }
          const {result} = await transactionResultManager(unSignTransaction, tronWebLedger);
          res = result;
        }
        if (this.props.walletType.type === "ACCOUNT_TRONLINK") {
          let unSignTransaction;
          if(!delegate) {
             unSignTransaction = await tronWeb.transactionBuilder.unfreezeBalance(delegateType, tronWeb.defaultAddress.base58).catch(e => false);
          }else{
             unSignTransaction = await tronWeb.transactionBuilder.unfreezeBalance(delegateType, tronWeb.defaultAddress.base58,delegateValue).catch(e => false);
          }
          const {result} = await transactionResultManager(unSignTransaction, tronWeb);
          res = result;
        }

      } catch (e) {
        console.log(e)
      }
    } else {
      if(!delegate) {
        let {success} = await Client.unfreezeBalance(account.address, delegateType, '')(account.key);
        res = success
      }else{
        let {success} = await Client.unfreezeBalance(account.address, delegateType, delegateValue)(account.key);
        res = success
      }
    }

    if (res) {
      this.setState({
        modal: (
            <SweetAlert success title="TRX Unfrozen" onConfirm={this.hideFreezeModal}>
              {tu("success_unfrozen_trx")}
            </SweetAlert>
        )
      });
      setTimeout(() => this.reloadTokens(), 1200);
    } else {
      this.setState({
        modal: (
            <SweetAlert warning title={tu("unable_to_unfreeze")} onConfirm={this.hideFreezeModal}>
              {tu("unable_unfreeze_trx_message")}
            </SweetAlert>
        ),
      });
    }
  };

  unfreezeAssets = async () => {
    let {account} = this.props;
    let {privateKey} = this.state;
    let res;
    this.hideModal();
    if (this.state.isTronLink === 1) {
      let tronWeb;
      if (this.props.walletType.type === "ACCOUNT_LEDGER") {
        tronWeb = this.props.tronWeb();
      } else if (this.props.walletType.type === "ACCOUNT_TRONLINK") {
        tronWeb = account.tronWeb;
      }
      const unSignTransaction = await tronWeb.fullNode.request('wallet/unfreezeasset', {
        owner_address: tronWeb.defaultAddress.hex,
      }, 'post').catch(e => false);
      const {result} = await transactionResultManager(unSignTransaction, tronWeb)
      res = result;
    } else {
      let {success} = await Client.unfreezeAssets(account.address)(account.key);
      res = success;
    }

    if (res) {
      this.setState({
        modal: (
            <SweetAlert success title={tu("tokens_unfrozen")} onConfirm={this.hideModal}>
              {tu("success_tokens_unfrozen_message")}
            </SweetAlert>
        )
      });

      setTimeout(() => this.loadAccount(), 1200);
      setTimeout(() => this.props.reloadWallet(), 1200);

    } else {
      this.setState({
        modal: (
            <SweetAlert warning title={tu("unable_to_unfreeze")} onConfirm={this.hideModal}>
              {tu("Unable_tokens_unfrozen_message")}
            </SweetAlert>
        ),
      });
    }
  };

  showFreezeConfirmation = (amount) => {
    this.setState({
      modal: (
          <SweetAlert success title={tu("tokens_frozen")} onConfirm={this.hideModal}>
            {tu("successfully_frozen")} {amount} TRX
          </SweetAlert>
      )
    });

    setTimeout(() => this.props.reloadWallet(), 1000);
  };

  updateName = async (name) => {
    let res;
    let {account, currentWallet, onError} = this.props;

    try {
      if (this.props.walletType.type === "ACCOUNT_LEDGER") {
        let tronWebLedger = this.props.tronWeb();

        const unSignTransaction = await tronWebLedger.transactionBuilder.updateAccount(name, this.props.walletType.address);
        const {result} = await transactionResultManager(unSignTransaction, tronWebLedger);
        res = result;

      } else if (this.props.walletType.type === "ACCOUNT_TRONLINK") {
        let tronWeb = account.tronWeb;
        const unSignTransaction = await tronWeb.fullNode.request('wallet/updateaccount', {
          account_name: tronWeb.fromUtf8(name),
          owner_address: tronWeb.defaultAddress.hex
        }, 'post').catch(e => false);
        const {result} = await  transactionResultManager(unSignTransaction, tronWeb);
        res = result;
      } else {
        let {success} = await Client.updateAccountName(currentWallet.address, name)(account.key);
        res = success;
      }
    } catch (e) {
      console.error(e);
      onError && onError();
    }
    if (res) {
      this.setState({
        temporaryName: name,
        modal: (
            <SweetAlert success title={tu("name_changed")} onConfirm={this.hideModal}>
              {tu("successfully_changed_name_to_message")} <b>{name}</b>
            </SweetAlert>
        )
      });
      setTimeout(() => this.props.reloadWallet(), 1000);
    } else {
      this.setState({
        modal: (
            <SweetAlert warning title={tu("unable_to_rename_title")} onConfirm={this.hideModal}>
              {tu("unable_to_rename_message")}
            </SweetAlert>
        )
      })
    }
  };

  updateWebsite = async (url) => {
    let res;
    let {account, currentWallet} = this.props;
    if (this.state.isTronLink === 1) {
      let tronWeb;
      if (this.props.walletType.type === "ACCOUNT_LEDGER") {
        tronWeb = this.props.tronWeb();
      } else if (this.props.walletType.type === "ACCOUNT_TRONLINK") {
        tronWeb = account.tronWeb;
      }
      const unSignTransaction = await tronWeb.fullNode.request('wallet/updatewitness', {
            update_url: tronWeb.fromUtf8(url),
            owner_address: tronWeb.defaultAddress.hex
          },
          'post');
      const {result} = await transactionResultManager(unSignTransaction, tronWeb);
      res = result;
    } else {
      let {success} = await Client.updateWitnessUrl(currentWallet.address, url)(account.key);
      res = success;
    }

    if (res) {
      this.setState({
        modal: (
            <SweetAlert success title={tu("url_changed")} onConfirm={this.hideModal}>
              {tu("successfully_changed_website_message")} <b>{url}</b>
            </SweetAlert>
        )
      });

      setTimeout(() => this.props.reloadWallet(), 1000);
    } else {
      this.setState({
        modal: (
            <SweetAlert warning title={tu("unable_to_change_website_title")} onConfirm={this.hideModal}>
              {tu("unable_to_change_website_message")}
            </SweetAlert>
        )
      })
    }
  };

  createTxnPair = async (firstTokenId, secondTokenId, firstTokenBalance, secondTokenBalance) => {
    let res;
    let {account, currentWallet} = this.props;
    if (this.props.walletType.type === "ACCOUNT_LEDGER") {
      const tronWeb = this.props.tronWeb();
      const unSignTransaction = await tronWeb.transactionBuilder.createTRXExchange(firstTokenId, firstTokenBalance, secondTokenBalance, currentWallet.address).catch(e => false);
      const {result} = await  transactionResultManager(unSignTransaction, tronWeb);
      res = result;
    }else if (this.props.walletType.type === "ACCOUNT_TRONLINK") {
      const tronWeb = account.tronWeb;
      const unSignTransaction = await tronWeb.transactionBuilder.createTRXExchange(firstTokenId, firstTokenBalance, secondTokenBalance, tronWeb.defaultAddress.hex).catch(e => false);
      const {result} = await  transactionResultManager(unSignTransaction, tronWeb);
      res = result;
    }else {
      const {success} = await Client.createExchange(currentWallet.address, firstTokenId, secondTokenId, firstTokenBalance, secondTokenBalance)(account.key);
      res = success;
    }
    
    if (res) {
      this.setState({
        temporaryName: name,
        modal: (
            <SweetAlert success onConfirm={this.hideModal}>
              {tu("successfully_created_pair")}
            </SweetAlert>
        )
      });

      setTimeout(() => this.props.reloadWallet(), 1000);
    } else {
      this.setState({
        modal: (
            <SweetAlert warning onConfirm={this.hideModal}>
              {tu("pair_creation_failed")}
            </SweetAlert>
        )
      })
    }
  };

  injectExchange = async (exchangeId, tokenId, quant) => {
    let res;
    let {account, currentWallet} = this.props;
    if (this.props.walletType.type === "ACCOUNT_LEDGER") {
      const tronWeb = this.props.tronWeb();
      const unSignTransaction = await tronWeb.transactionBuilder.injectExchangeTokens(exchangeId, tokenId, quant, currentWallet.address).catch(e => false);
      const {result} = await  transactionResultManager(unSignTransaction, tronWeb);
      res = result;
    }else if (this.props.walletType.type === "ACCOUNT_TRONLINK") {
      const tronWeb = account.tronWeb;
      const unSignTransaction = await tronWeb.transactionBuilder.injectExchangeTokens(exchangeId, tokenId, quant, tronWeb.defaultAddress.hex).catch(e => false);
      const {result} = await  transactionResultManager(unSignTransaction, tronWeb);
      res = result;
    } else {
      const {success} = await Client.injectExchange(currentWallet.address, exchangeId, tokenId, quant)(account.key);
      res = success;
    }
    if (res) {
      this.setState({
        temporaryName: name,
        modal: (
            <SweetAlert success onConfirm={this.hideModal}>
              {tu("successful_injection")}
            </SweetAlert>
        )
      });

      setTimeout(() => this.props.reloadWallet(), 5000);
    } else {
      this.setState({
        modal: (
            <SweetAlert warning onConfirm={this.hideModal}>
              {tu("sorry_injection_failed")}
            </SweetAlert>
        )
      })
    }
  };

  withdrawExchange = async (exchangeId, tokenId, quant) => {
    let res;
    let {account, currentWallet} = this.props;
    if (this.props.walletType.type === "ACCOUNT_LEDGER") {
      const tronWeb = this.props.tronWeb();
      const unSignTransaction = await tronWeb.transactionBuilder.withdrawExchangeTokens(exchangeId, tokenId, quant, currentWallet.address).catch(e => false);
      const {result} = await  transactionResultManager(unSignTransaction, tronWeb);
      res = result;
    }else if (this.props.walletType.type === "ACCOUNT_TRONLINK") {
      const tronWeb = account.tronWeb;
      const unSignTransaction = await tronWeb.transactionBuilder.withdrawExchangeTokens(exchangeId, tokenId, quant, tronWeb.defaultAddress.hex).catch(e => false);
      const {result} = await  transactionResultManager(unSignTransaction, tronWeb);
      res = result;
    } else {
      const {success} = await Client.withdrawExchange(currentWallet.address, exchangeId, tokenId, quant)(account.key);
      res = success;
    }
    if (res) {
      this.setState({
        temporaryName: name,
        modal: (
            <SweetAlert success onConfirm={this.hideModal}>
              {tu("successful_withdrawal")}
            </SweetAlert>
        )
      });

      setTimeout(() => this.props.reloadWallet(), 5000);
    } else {
      this.setState({
        modal: (
            <SweetAlert warning onConfirm={this.hideModal}>
              {tu("sorry_withdrawal_failed")}
            </SweetAlert>
        )
      })
    }
  };

  changeName = () => {
    this.setState({
      modal: (
          <ChangeNameModal
              onConfirm={(name) => this.updateName(name)}
              onCancel={this.hideModal}/>
      )
    })
  };

  changeTxnPair = () => {
    this.setState({
      modal: (
          <CreateTxnPairModal
              onCreate={(firstTokenId, secondTokenId, firstTokenBalance, secondTokenBalance) => this.createTxnPair(firstTokenId, secondTokenId, firstTokenBalance, secondTokenBalance)}
              onCancel={this.hideModal}
              dealPairTrxLimit={this.state.dealPairTrxLimit}
          />
      )
    })
  };

  injectTxnPair = (exchange) => {
    this.setState({
      modal: (
          <OperateTxnPairModal
              onInject={(exchangeId, tokenId, quant) => this.injectExchange(exchangeId, tokenId, quant)}
              onCancel={this.hideModal}
              exchange={exchange}
              inject={true}
          />
      )
    })
  };

  withdrawTxnPair = (exchange) => {
    this.setState({
      modal: (
          <OperateTxnPairModal
              onWithdraw={(exchangeId, tokenId, quant) => this.withdrawExchange(exchangeId, tokenId, quant)}
              onCancel={this.hideModal}
              exchange={exchange}
              inject={false}
              dealPairTrxLimit={this.state.dealPairTrxLimit}
          />
      )
    })
  };


  changeGithubURL = async () => {
    this.setState({
      modal: (
          this.state.isTronLink === 1 ?
              <SweetAlert onCancel={this.hideModal} onConfirm={this.hideModal}>
                {tu("change_login_method")}
              </SweetAlert>
              :
              <SweetAlert
                  input
                  showCancel
                  cancelBtnBsStyle="default"
                  cancelBtnText={tu("cancel")}
                  confirmBtnText={tu("link_github")}
                  title={tu("link_to_github")}
                  placeHolder="github username or https://github.com/{username}/tronsr-template"
                  onCancel={this.hideModal}
                  validationMsg={tu("you_must_enter_a_url")}
                  onConfirm={async (name) => {
                    if (await this.detectGithubUrl(name)) {
                      this.setState({
                        modal: (
                            <SweetAlert success title={tu("github_linked")} onConfirm={this.hideModal}>
                              {tu("successfully_linked_github")}
                            </SweetAlert>
                        )
                      });
                    } else {
                      this.setState({
                        modal: (
                            <SweetAlert
                                danger
                                showCancel
                                title={tu("could_not_link_github")}
                                onCancel={this.hideModal}
                                onConfirm={this.changeGithubURL}>
                              {tu("unable_to_link_github_message")}
                            </SweetAlert>
                        )
                      });
                    }
                  }}>
                {tu("enter_your_github_username")}
              </SweetAlert>
      )
    });
  };

  hasGithubLink = () => {
    let {sr} = this.state;
    return sr && (trim(sr.githubLink).length !== 0);
  };

  detectGithubUrl = async (input) => {

    let urls = [
      `https://raw.githubusercontent.com/${input}/tronsr-template/master/logo.png`,
      `https://raw.githubusercontent.com/${input}/master/logo.png`,
    ];

    for (let url of urls) {
      try {
        await xhr.get(url);
        await this.updateGithubURL(input);
        return true;
      } catch (e) {

      }
    }

    return false;
  };

  updateGithubURL = async (url) => {
    let {account, currentWallet} = this.props;
    let key = await Client.auth(account.key);
    let [name, repo] = url.split("/");
    let githubLink = name + "/" + (repo || "tronsr-template");
    if (this.state.isTronLink === 1) {
      // const tronWeb = this.props.tronWeb();
      // const unSignTransaction = await tronWeb.transactionBuilder.withdrawExchangeTokens(exchangeId, tokenId, quant, tronWeb.defaultAddress.hex);
      // await transactionResultManager(unSignTransaction,tronWeb)
      return;
    } else {
      await Client.updateSuperRepresentative(key, {
        address: currentWallet.address,
        githubLink,
      });
    }
    this.loadAccount();
  };
  changeWebsite = () => {
    this.setState({
      modal: (
          <SweetAlert
              input
              showCancel
              cancelBtnBsStyle="default"
              title={tu("change_website")}
              placeHolder="https://"
              onCancel={this.hideModal}
              validationMsg={tu("you_must_enter_url")}
              onConfirm={(name) => this.updateWebsite(name)}>
            {tu("specify_the_url")}
          </SweetAlert>
      )
    });
  };

  applyForDelegate = () => {
    let {privateKey} = this.state;

    this.setState({
      modal: (
          <ApplyForDelegate
              isTronLink={this.state.isTronLink}
              privateKey={privateKey}
              onCancel={this.hideModal}
              onConfirm={() => {
                setTimeout(() => this.props.reloadWallet(), 1200);
                this.setState({
                  modal: (
                      <SweetAlert success title={tu("success")} onConfirm={this.hideModal}>
                        {tu("successfully_appied_sr_canidate_message_0")} <br/>
                        {tu("successfully_appied_sr_canidate_message_1")}
                      </SweetAlert>
                  )
                });
              }}/>
      )
    })
  };

  showQrCode = () => {

    let {currentWallet,account} = this.props;

    this.setState({
      modal: (
          <Modal className="modal-dialog-centered animated zoomIn" fade={false} isOpen={true} toggle={this.hideModal} style={{width: '400px'}}>
            <ModalHeader toggle={this.hideModal}>QR CODE</ModalHeader>
            <ModalBody className="text-center">
              <h5 className="py-2">{tu("wallet_address")}</h5>
              <div className="input-group mb-3">
                <input type="text"
                       readOnly={true}
                       className="form-control"
                       value={account.address}/>
                <div className="input-group-append">
                  <CopyToClipboard text={account.address}>
                    <button className="btn btn-outline-secondary" type="button">
                      <i className="fa fa-paste"/>
                    </button>
                  </CopyToClipboard>
                </div>
              </div>
              <hr/>
              <QRCode size={512} style={{width: '100%', height: 'auto'}} value={account.address}/><br/>
            </ModalBody>
          </Modal>
      )
    });
  };

  toissuedAsset = () => {
    let {issuedAsset} = this.state;
    window.location.hash = "#/token/" + issuedAsset.id;
  }

  handleSwitch = (val) => {
    this.setState({hideSmallCurrency: val});
  }

  handleTRC10Token = () => {
    this.setState({tokenTRC10: true});
  }

  handleTRC20Token = () => {
    this.setState({tokenTRC10: false});
  }

  render() {
    let {modal, sr, issuedAsset, showBandwidth, showBuyTokens, temporaryName, hideSmallCurrency, tokenTRC10} = this.state;

    let {account, frozen, totalTransactions, currentWallet, wallet, accountResource, trxBalance, intl} = this.props;

    if (!wallet.isOpen || !currentWallet) {
      return (
          <main className="container header-overlap">
            <div className="row">
              <div className="col-md-12">
                <div className="card p-3">
                  <h5 className="text-muted text-center">
                    {tu("no_open_wallet")}
                  </h5>
                </div>
              </div>
            </div>
          </main>
      );
    }
    let hasFrozen = frozen.balances.length > 0;
    let hasResourceFrozen = accountResource.frozen_balance > 0
    let url = 'https://support.trx.market/hc/en-us/articles/360030644412-TRC20-USDT-Reloaded-with-Powerful-Aid-from-TRXMarket-15-000-USD-Awaits-'
    let title = 'TRC20-USDT Returns with Generous Rewards from TRXMarket - 15,000 USDT Awaits!'
    if(intl.locale == 'zh'){
      url = 'https://support.trx.market/hc/zh-cn/articles/360030644412-TRXMarket%E5%8A%A9%E5%8A%9BTRC20-USDT%E9%87%8D%E8%A3%85%E4%B8%8A%E9%98%B5-%E6%83%8A%E5%96%9C%E6%94%BE%E9%80%8110%E4%B8%87%E4%BA%BA%E6%B0%91%E5%B8%81'
      title = 'TRXMarket助力TRC20-USDT重装上阵，惊喜放送10万人民币'
    }
   
    return (
        <main className="container header-overlap token_black accounts">
          {modal}
          {/* 广告位文字 */}
          {/* <div className="text-center alert alert-light alert-dismissible fade show" role="alert">
            <a href={url} target="_blank" style={{textDecoration: 'none'}}>
              {title}
            </a>
            <button type="button" className="close" data-dismiss="alert" aria-label="Close">
              <span aria-hidden="true">&times;</span>
            </button>
          </div> */}
          <div className="row">
            <div className="col-md-3">
              <div className="card h-100 bg-line_red bg-image_band">
                <div className="card-body">
                  <h3 style={{color: '#C23631'}}>
                    <FormattedNumber
                        value={currentWallet.bandwidth.netRemaining + currentWallet.bandwidth.freeNetRemaining}/>
                  </h3>
                  {/* <a href="javascript:;"
                     onClick={() => this.setState(state => ({showBandwidth: !state.showBandwidth}))}>
                    {tu("bandwidth")}
                  </a> */}
                  {tu("bandwidth")}
                  <span className="ml-2">
                      <QuestionMark placement="top" text="bandwidth_tip"/>
                  </span>
                </div>
              </div>
            </div>

            <div className="col-md-3 mt-3 mt-md-0">
              <div className="card h-100 bg-line_blue bg-image_engry">
                <div className="card-body">
                  <h3 style={{color: '#4A90E2'}}>
                    <FormattedNumber value={currentWallet.bandwidth.energyRemaining}/>
                  </h3>
                  {tu("energy")}
                  <span className="ml-2">
                      <QuestionMark placement="top" text="energy_tip"/>
                  </span>
                </div>
              </div>
            </div>

            <div className="col-md-3 mt-3 mt-md-0" >
              <div className="card h-100 bg-line_yellow bg-image_vote">
                <div className="card-body">
                  <h3 style={{color: '#E0AE5C'}}>
                    <FormattedNumber value={currentWallet.frozenTrx / ONE_TRX}/>
                  </h3>
                  TRON {tu("power")}
                  <span className="ml-2">
                      <QuestionMark placement="top" text="power_tip"/>
                  </span>
                </div>
              </div>
            </div>

            <div className="col-md-3 mt-3 mt-md-0">
              <div className="card h-100 bg-line_green bg-image_balance">
                <div className="card-body">
                  <h3 style={{color: '#93C54B'}}>
                    <TRXPrice amount={currentWallet.balance / ONE_TRX}/>
                  </h3>
                  {tu("available_balance")}
                </div>
              </div>
            </div>
          </div>
          {showBandwidth && this.renderBandwidth()}
          <div className="row mt-3">
            <div className="col-md-12">
              <div className="card px-3">
                {
                  currentWallet.representative.enabled &&
                  <div className="card-header bg-info text-center font-weight-bold text-white">Representative</div>
                }
                <div className="table-responsive">
                  <table className="table m-0">
                    <tbody>
                    {
                      wallet.isOpen &&
                      <tr>
                        <th style={{border: 'none'}}>{tu("name")}:</th>
                        <td style={{border: 'none'}}>
                          {currentWallet.name || temporaryName || "-"}
                          {
                            (trim(currentWallet.name) === "" && (currentWallet.balance > 0 || currentWallet.frozenTrx > 0)) &&
                            <a href="javascript:" className="float-right text-primary btn btn-default btn-sm"
                               onClick={() => {
                                 this.changeName()
                               }}>
                              {tu("set_name")}
                            </a>
                          }
                        </td>
                      </tr>
                    }
                    {
                      currentWallet.representative.enabled &&
                      <tr>
                        <th>{tu("website")}:</th>
                        <td>
                          <a href={currentWallet.representative.url}>{currentWallet.representative.url}</a>
                          <a href="javascript:" className="float-right text-primary btn btn-default btn-sm"
                             onClick={() => {
                               this.changeWebsite()
                             }}>
                            {tu("change_website")}
                          </a>

                        </td>
                      </tr>
                    }
                    <tr>
                      <th style={{width: 150}}>{tu("address")}:</th>
                      <td>
                        <a href="javascript:" className="float-right text-primary btn btn-default btn-sm"
                           onClick={this.showQrCode}>
                          {tu("show_qr_code")}
                        </a>

                        <div className="float-left" style={{width: 350}}>
                          <AddressLink address={account.address} includeCopy={true}/>
                        </div>

                        {
                          IS_TESTNET &&
                          <p className="text-danger">
                            ({tu("do_not_send_2")})
                          </p>
                        }
                      </td>
                    </tr>
                    <tr>
                      <th>{tu("transactions")}:</th>
                      <td>
                        <FormattedNumber value={totalTransactions}/>
                      </td>
                    </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <IssuedToken issuedAsset={issuedAsset} loadAccount={this.loadAccount} unfreezeAssetsConfirmation={this.unfreezeAssetsConfirmation}/>
          {
            false &&
            <div className="row mt-3">
              <div className="col-md-12">
                <div className="card">
                  <div className="card-body">
                    <h5 className="card-title text-center m-0">
                      {tu("issued_token")}
                    </h5>

                    <table className="table mt-3 temp-table">
                      <tbody>
                      <tr>
                        <th style={{width: 150}}>{tu("name")}:</th>
                        <td>
                            <div className="d-flex justify-content-between">
                              <div>
                                <TokenLink id={issuedAsset.id} name={issuedAsset.name} address={issuedAsset.ownerAddress} namePlus={issuedAsset.name + ' (' + issuedAsset.abbr + ')'}/>
                                <span style={{color:"#999",fontSize:12}}>[{issuedAsset.id}]</span>
                              </div>
                              {
                                  (issuedAsset.canShow == 0 || issuedAsset.canShow == 1 || issuedAsset.canShow == 2)&&
                                <div className="d-flex align-items-center">
                                  <img src={require("../../images/token/audited.png")} width="14" height="14" className="mr-1"/>
                                  {tu("Passed_audit")}
                                </div>
                              }
                              {/*{*/}
                                {/*(issuedAsset.canShow == 0 || issuedAsset.canShow == 2)&&*/}
                                {/*<div className="d-flex align-items-center">*/}
                                  {/*<img src={require("../../images/token/auditing.png")} width="14" height="14" className="mr-1"/>*/}
                                  {/*{tu("Auditing")}*/}
                                {/*</div>*/}
                              {/*}*/}
                              {
                                issuedAsset.canShow == 3&&
                                <div className="d-flex align-items-center">
                                  <img src={require("../../images/token/noadit.png")} width="14" height="14" className="mr-1"/>
                                  {tu("Audit_failed")}
                                </div>
                              }
                              
                            </div>
                            

                        </td>
                      </tr>
                      <tr>
                        <th>{tu("start_date")}:</th>
                        <td>
                          {issuedAsset.endTime - issuedAsset.startTime > 1000 ?
                              <span><FormattedDate value={issuedAsset.startTime}/>{' '}<FormattedTime
                                  value={issuedAsset.startTime}  hour='numeric' minute="numeric" second='numeric' hour12={false}/></span> : "-"}
                        </td>
                      </tr>
                      <tr>
                        <th>{tu("end_date")}:</th>
                        <td>
                          {issuedAsset.endTime - issuedAsset.startTime > 1000 ?
                              <span><FormattedDate value={issuedAsset.endTime}/>{' '}<FormattedTime
                                  value={issuedAsset.endTime}  hour='numeric' minute="numeric" second='numeric' hour12={false}/></span> : "-"}
                        </td>
                      </tr>
                      <tr>
                        <th>{tu("progress")}:</th>
                        <td className="d-flex">
                          <div className="progress mt-1" style={{width: '95%'}}>
                            <div className="progress-bar bg-success"
                                 style={{width: issuedAsset.issuedPercentage + '%'}}/>
                          </div>
                          <div className="ml-2">{issuedAsset.issuedPercentage.toFixed(3) + '%'}</div>
                        </td>
                      </tr>
                      {
                          currentWallet && currentWallet.frozen_supply.length > 0 &&
                        <tr>
                          <th>{tu("frozen_supply")}:</th>
                          <td>
                            <a href="javascript:" className="float-right text-primary"
                               onClick={() => {
                                 this.unfreezeAssetsConfirmation()
                               }}>
                              {tu("unfreeze_assets")}
                            </a>
                            {
                                currentWallet.frozen_supply.map((frozen, index) => (
                                  <div key={index}>
                                    {frozen.amount / Math.pow(10, issuedAsset.precision)}
                                    {
                                      (frozen.expires > getTime(new Date())) ?
                                          <span>
                                          <span> {tu("can_be_unlocked")}&nbsp;</span>
                                          <FormattedRelative
                                              value={frozen.expires}/>
                                      </span> : <span> {tu("can_be_unlocked_now")}&nbsp;</span>
                                    }
                                  </div>
                              ))
                            }
                          </td>
                        </tr>
                      }
                      </tbody>
                    </table>
                    <div className="d-flex align-items-center">
                      <button className="btn btn-danger btn-lg mb-3 mr-3" onClick={this.toissuedAsset}
                            style={{minWidth: '120px'}}>{tu('token_detail')}</button>
                      <p style={{color: 'rgb(153, 153, 153)',fontSize: '12px'}}>{tu("Have_questions")} <a href="https://t.me/tronscan_org" target="_bank">{tu("Please_contact_us")}</a></p>
                    </div>
                    
                  </div>
                </div>
              </div>
            </div>
          }
          <div className="row mt-3">
            <div className="col-md-12">
              <div className="card">
                <div className="card-body temp-table">
                  <div className="d-flex justify-content-between account-switch">
                    <h5 className="card-title text-center m-0">
                      {tu("tokens")}
                    </h5>
                    <SwitchToken handleSwitch={this.handleSwitch} text="hide_small_currency"
                                 hoverText="tokens_less_than_10"/>
                  </div>
                  <div className="account-token-tab">
                    <a href="javascript:;"
                       className={"btn btn-default btn-sm" + (tokenTRC10 ? ' active' : '')}
                       onClick={this.handleTRC10Token}>
                      {tu("TRC10_token")}
                    </a>
                    <a href="javascript:;"
                       className={"btn btn-default btn-sm ml-2" + (tokenTRC10 ? '' : ' active')}
                       onClick={this.handleTRC20Token}>
                      {tu("TRC20_token")}
                    </a>
                    <a href={`https://trx.market`} className="ml-2 float-right" target="_blank"><span className="mr-1"  style={{textDecoration: 'underline'}}>{t("Trade_on_TRXMarket")}</span>></a>
                    
                  </div>
                  {
                    tokenTRC10 ? <div className="table-responsive-token">
                          {this.renderTokens()}
                        </div>
                        :
                        <div className="table-responsive-token">
                          {this.renderTRC20Tokens()}
                        </div>
                  }
                </div>
              </div>
            </div>
          </div>
          <div className="row mt-3">
            <div className="col-md-12">
              <div className="card">
                <div className="card-body">
                  <div className="d-flex justify-content-between trade_pair_title">
                    <h5 className="card-title text-center">
                      {tu("my_trading_pairs")}
                      {tu("deal_pair_tip")}
                    </h5>
                    <p className="card-text">
                      <a href="javascript:"
                         className={trxBalance >= this.state.dealPairTrxLimit ? "btn btn-default btn-sm btn-plus-square" : "float-right btn btn-default btn-sm btn-plus-square disabled"}
                         onClick={() => {
                           this.changeTxnPair()
                         }}>
                        <i className="fa fa-plus-square"></i>
                        &nbsp;
                        {tu("create_trading_pairs")}
                      </a>
                    </p>
                  </div>
                  <div style={{overflowX: 'auto'}}>
                    <table className="table m-0 temp-table mt-4">
                      <thead className="thead-light">
                      <tr>
                        <th>{tu("pairs")}</th>
                        <th>{tu("balance")}</th>
                        <th className="text-right"></th>
                      </tr>
                      </thead>
                      <tbody>
                      {
                        currentWallet.exchanges.length ? currentWallet.exchanges.map((exchange, index) => {
                          return (
                              <tr key={index}>
                                <td style={{position: 'relative'}}>
                                  {exchange.map_token_name === "_" ? "TRX" : exchange.map_token_name}/{exchange.map_token_name1 === "_" ? "TRX" : exchange.map_token_name1}
                                  <div style={{
                                    fontSize: 12,
                                    color: '#999',
                                    position: 'absolute',
                                    bottom: 0
                                  }}>[ID:{exchange.map_token_id}]
                                  </div>
                                </td>
                                <td>
                                  <FormattedNumber value={exchange.map_amount}/>
                                  /
                                  <FormattedNumber value={exchange.map_amount1}/>
                                </td>
                                <td className="text-right"
                                    style={{display: 'flex', flexDirection: 'row', justifyContent: 'flex-end'}}>
                                  <div className="dex-inject" style={{whiteSpace: 'nowrap'}}
                                       onClick={() => {
                                         this.injectTxnPair(exchange)
                                       }}
                                  >
                                    {tu("capital_injection")}
                                  </div>
                                  |
                                  <div className="dex-divestment" style={{whiteSpace: 'nowrap'}}
                                       onClick={() => {
                                         this.withdrawTxnPair(exchange)
                                       }}
                                  >
                                    {tu("capital_withdrawal")}
                                  </div>
                                </td>
                              </tr>
                          )
                        }) : <tr>
                          <td></td>
                          <td>
                            {tu('no_pairs')}
                          </td>
                          <td></td>
                        </tr>
                      }
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/*<div className="row mt-3">*/}
          {/*<div className="col-md-12">*/}
          {/*<div className="card">*/}
          {/*<div className="card-body">*/}
          {/*<h5 className="card-title text-center m-0">*/}
          {/*{tu('apply_for_process')}*/}
          {/*</h5>*/}
          {/*<p className="pt-3">*/}
          {/*{tu('token_application_instructions_1')}*/}
          {/*</p>*/}
          {/*<div className="text-center">*/}
          {/*<a href="https://goo.gl/forms/OXFG6iaq3xXBHgPf2" target="_blank">*/}
          {/*<button className="btn btn-danger">*/}
          {/*{t("apply_for_the_currency")}*/}
          {/*</button>*/}
          {/*</a>*/}
          {/*</div>*/}
          {/*</div>*/}
          {/*</div>*/}
          {/*</div>*/}
          {/*</div>*/}
          <div className="row mt-3">
            <div className="col-md-12">
              <div className="card">
                <div className="card-body temp-table">
                  <h5 className="card-title text-center m-0">
                    {tu("transactions")}
                  </h5>
                  {this.renderTransactions()}
                </div>
              </div>
            </div>
          </div>
          <div className="row mt-3" id="tronPower">
            <div className="col-md-12">
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title text-center m-0">
                    TRON {tu("power")}
                  </h5>

                  <div className="card-body px-0 d-lg-flex justify-content-lg-between">
                    <p className="card-text freeze-trx-premessage">
                      {tu("freeze_trx_premessage_0")}
                      <Link to="/sr/votes">{t("freeze_trx_premessage_link")}</Link>
                      {tu("freeze_trx_gain_bandwith_energy")}
                      <br/>
                      <br/>{tu("freeze_trx_premessage_1")}
                      <br/>
                      <br/>{tu("freeze_trx_premessage_2")}
                    </p>
                    <div>
                      <button className="btn btn-primary" onClick={() => {
                        this.showFreezeBalance()
                      }}>
                        {tu("freeze")}
                      </button>
                    </div>
                  </div>

                  {this.renderFrozenTokens()}
                  {this.renderDelegateFrozenTokens()}
                </div>
              </div>
            </div>
          </div>
          {
            currentWallet.representative.enabled ?
                <div className="row mt-3">
                  <div className="col-md-12">
                    <div className="card">
                      <div className="card-body">
                        <h5 className="card-title text-center">
                          {tu("Super Representatives")}
                        </h5>
                        <p className="card-text">
                          {tu("sr_receive_reward_message_0")}
                        </p>
                        <div className="text-center">
                          <button className="btn btn-success"
                                  onClick={() => {
                                    this.claimRewards()
                                  }}
                                  disabled={currentWallet.representative.allowance === 0}
                          >
                            {tu("claim_rewards")}
                          </button>
                          {
                            currentWallet.representative.allowance > 0 ?
                                <p className="m-0 mt-3 text-success">
                                  Claimable Rewards: <TRXPrice amount={currentWallet.representative.allowance / ONE_TRX}
                                                               className="font-weight-bold"/>
                                </p> :
                                <p className="m-0 mt-3 font-weight-bold" style={{color: '#D0AC6E'}}>
                                  No rewards to claim
                                </p>
                          }
                        </div>
                        <hr/>
                        <h5 className="card-title text-center">
                          {tu("landing_page")}
                        </h5>
                        <div className="text-center">
                          <p className="card-text text-center">
                            {tu("create_sr_landing_page_message_0")}
                          </p>
                          <p className="text-center">
                            <HrefLink className="btn btn-danger"
                                      href="https://github.com/tronscan/tronsr-template#readme">
                              {tu("show_more_information_publish_sr_page")}
                            </HrefLink>
                          </p>
                          {
                            !this.hasGithubLink() &&
                            <Fragment>
                              <p className="card-text text-center">
                                {tu("set_github_url_message_0")}
                              </p>
                              <p className="text-center">
                                <button className="btn btn-dark mr-2" onClick={() => {
                                  this.changeGithubURL()
                                }}>
                                  {tu("set_github_link")}
                                </button>
                              </p>
                            </Fragment>
                          }
                        </div>
                      </div>
                      {
                        this.hasGithubLink() &&
                        <table className="table m-0">
                          <tbody>
                          <tr>
                            <th>{tu("Github Link")}:</th>
                            <td>
                              <HrefLink href={"http://github.com/" + sr.githubLink}
                                        target="_blank">{"http://github.com/" + sr.githubLink}</HrefLink>
                              <a href="javascript:;" className="float-right text-primary"
                                 onClick={() => {
                                   this.changeGithubURL()
                                 }}>
                                {tu("Change Github Link")}
                              </a>
                            </td>
                          </tr>
                          <tr>
                            <th>{tu("Representative Page")}</th>
                            <td><Link className="text-primary"
                                      to={`/representative/${currentWallet.address}`}>View</Link>
                            </td>
                          </tr>
                          </tbody>
                        </table>
                      }
                    </div>
                  </div>
                </div>
                :
                <div className="row mt-3">
                  <div className="col-md-12">
                    <div className="card">
                      <div className="card-body">
                        <h5 className="card-title text-center m-0">
                          {tu("Super Representatives")}
                        </h5>
                        <p className="pt-3">
                          {tu("apply_for_delegate_predescription")}
                        </p>
                        <div className="text-center">
                          {
                            !IS_TESTNET && <button className="apply-super-btn btn btn-success"
                                    onClick={() => {
                                      this.applyForDelegate()
                                    }}>
                              {tu("apply_super_representative_candidate")}
                            </button>
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
          }
          {/*
            IS_TESTNET && <div className="row mt-3">
              <div className="col-md-12">
                <div className="card">
                  <div className="card-body text-center">
                    <h5 className="card-title border-bottom-0 m-0">
                      {tu("testnet")}
                    </h5>
                    <TestNetRequest
                        account={account}
                        onRequested={() => setTimeout(() => this.reloadTokens(), 1500)}/>
                  </div>
                </div>
              </div>
            </div>
            */
          }
          {/*
        <div className="row mt-3">
            <div className="col-md-12">
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title text-center m-0">
                    {t("buy_trx")}
                  </h5>
                  <div className="py-3">
                    {t("buy_trx_message_0")}
                    <HrefLink href={"https://changelly.com/faq"}
                              target="_blank">{"changelly.com/faq"}</HrefLink>{"."}
                  </div>
                  <div className="text-center">
                    {
                      !showBuyTokens && <button className="btn btn-danger"
                                                onClick={() => this.setState(state => ({showBuyTokens: !state.showBuyTokens}))}>
                        {t("buy_trx_using_changelly")}
                      </button>
                    }
                  </div>
                  {
                    showBuyTokens && <iframe
                        src={"https://changelly.com/widget/v1?auth=email&from=USD&to=TRX&merchant_id=9i8693nbi7bzkyrr&address=" + currentWallet.address + "&amount=100&ref_id=9i8693nbi7bzkyrr&color=28cf00"}
                        height="500" className="changelly" scrolling="no"
                        style={{overflowY: 'hidden', border: 'none', width: '100%'}}> {t("cant_load_widget")}
                    </iframe>
                  }
                </div>
              </div>
            </div>
          </div>
          */}
        </main>
    )
  }
}
