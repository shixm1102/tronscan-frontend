import React, {Fragment} from "react";
import {Link} from "react-router-dom";
import {sampleSize} from "lodash";
import {Button, Modal, ModalBody, ModalFooter, ModalHeader} from "reactstrap";
import {ContextMenu, ContextMenuTrigger} from "react-contextmenu";
import SendModal from "../transfer/Send/SendModal";
import {tu, t} from "../../utils/i18n";
import {Truncate} from "./text";
import {CopyText} from "./Copy";
import {App} from "../../app";
import {CopyToClipboard} from "react-copy-to-clipboard";
import QRCode from "qrcode.react";
import { Client } from '../../services/api';

export const WitnessLink = ({address}) => (
    <Link to={`/witness/${address}`}>{address}</Link>
);

export const TokenLink = ({id, name, namePlus, address, children, ...props}) => {

  if(id == '_'){
      return <a href="javascript:;" >{children || name}</a>
  }
  if (name && !namePlus) {
    return (
        <Link to={`/token/${encodeURI(id)}`} {...props}>{children || name}</Link>
    )
  }
  if (namePlus && name) {
    return  (
        <Link to={`/token/${encodeURI(id)}`} {...props}>{children || namePlus}</Link>
    )
  }

};

export const TokenTRC20Link = ({name, namePlus, address, children, ...props}) => {

    if (name && !namePlus) {
        return <Link to={`/token20/${encodeURI(address)}`} {...props}>{children || name}</Link>
    }
    if (name && namePlus) {
        return <Link to={`/token20/${encodeURI(address)}`} {...props}>{children || namePlus}</Link>
    }
};

export class AddressLink extends React.PureComponent {

  constructor() {
    super();

    this.state = {
      isOpen: false,
      showSend: false,
      modal: null,
      random: sampleSize('abcdefghijklmnopqrstufwxyzABCDEFGHIJKLMNOPQRSTUFWXYZ1234567890', 12).join(''),
    };
  }

  hideModal = () => {
    this.setState({modal: null});
  };

  renderModal = () => {

    let {address} = this.props;

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
                       value={address}/>
                <div className="input-group-append">
                  <CopyToClipboard text={address}>
                    <button className="btn btn-outline-secondary" type="button">
                      <i className="fa fa-paste"/>
                    </button>
                  </CopyToClipboard>
                </div>
              </div>
              <hr/>
              <QRCode size={512} style={{width: '100%', height: 'auto'}} value={address}/><br/>
            </ModalBody>
          </Modal>
      )
    });
  };

  renderSend = () => {

    let {address} = this.props;

    this.setState({
      modal: (
          <SendModal
              to={address}
              isOpen={true}
              onClose={this.hideModal}/>
      )
    });

  };

  renderContextMenu(random) {
    return (
        <ContextMenu id={random} style={{zIndex: 1040}} className="dropdown-menu show">
          <Fragment>
            <a className="dropdown-item" href="javascript:" onClick={this.renderModal}>
              <i className="fas fa-qrcode mr-2"/>
              {t("show_qr_code")}
            </a>
            <a className="dropdown-item" href="javascript:" onClick={this.renderSend}>
              <i className="fas fa-exchange-alt mr-2"/>
              {t("send_tokens")}
            </a>
          </Fragment>
        </ContextMenu>
    );
  }

  render() {

    let {isContract = false, address = null, width = -1, children, showQrCode = false, wrapClassName, includeCopy = false, truncate = true, className = "", ...props} = this.props;
    let {modal, random} = this.state;

    let style = {};

    if (width !== -1) {
      style.maxWidth = width;
    }

    let wrap = (
        <div className="d-flex">
          {
            !isContract ?
              <Link
                  //to={`/address/${address}/token-balances`}
                  to={`/address/${address}`}
                  style={style}
                  className={"text-truncate address-link  " + className}
                  {...props}>
                {children ? children : address}
              </Link> :
              <Link
                  to={`/contract/${address}/code`}
                  style={style}
                  className={"text-truncate address-link " + className}
                  {...props}>
                {children ? children : address}
              </Link>
          }
          {
            includeCopy &&
            <CopyText text={address} className="ml-1"/>
          }
        </div>
    );

    if (truncate) {
      wrap = (
          <Truncate>
            {wrap}
          </Truncate>
      )
    }

    return (
        <span className={wrapClassName}>
        {modal}
          <ContextMenuTrigger id={random}>
          {wrap}
        </ContextMenuTrigger>
          {showQrCode &&
          <a href="javascript:;" className="ml-1" onClick={this.renderModal}>
            <i className="fa fa-qrcode"/>
          </a>
          }
          {this.renderContextMenu(random)}
      </span>
    )
  }
}

export class ExternalLink extends React.PureComponent {

  constructor() {
    super();

    this.state = {
      modal: null,
    };
  }

  hideModal = () => {
    this.setState({modal: null});
  };

  renderExternalLink() {
    let {url, _url} = this.props;

    let urlHandler = App.getExternalLinkHandler();
    if (urlHandler) {
      return (
          <a className="btn btn-primary"
             href="javascript:;"
             onClick={() => {
               urlHandler(url);
               this.hideModal();
             }}
             target="_blank">{tu("continue_to_external_website")}</a>
      );
    } else {
      if (_url)
        url = _url;
      if (url.toLowerCase().indexOf("http://") < 0 && url.toLowerCase().indexOf("https://") < 0)
        url = "http://" + url;
      return (
          <a className="btn btn-primary"
             href={url}
             onClick={this.hideModal}
             target="_blank">{tu("continue_to_external_website")}</a>
      );
    }
  }

  onClickUrl = (ev) => {

    let {url} = this.props;

    ev.preventDefault();
    ev.stopPropagation();

    this.setState({
      modal: (
          <Modal className="modal-dialog-centered" fade={false} isOpen={true} toggle={this.hideModal}>
            <ModalHeader className="text-center">
              {tu("open_external_link")}
            </ModalHeader>
            <ModalBody className="text-center p-3" onClick={this.hideModal}>
              <span
                  className="font-weight-bold text-truncate d-block">{url}</span> {t("no_official_tron_website")} &nbsp;
              {tu("private_key_untrusted_website_message_0")}
            </ModalBody>
            <ModalFooter>
              {this.renderExternalLink()}
              &nbsp;
              <Button color="secondary" onClick={this.hideModal}>{tu("cancel")}</Button>
            </ModalFooter>
          </Modal>
      )
    });
  };

  render() {

    let {url = '', children = null, className = '', ...props} = this.props;
    let {modal} = this.state;

    return (
        <Fragment>
          {modal}
          <a href={url} onClick={this.onClickUrl} {...props} className={'text-truncate d-block' + className}>{children || url}</a>
        </Fragment>
    )
  }
}

export function HrefLink({href, children, ...props}) {

  let urlHandler = App.getExternalLinkHandler();
  if (urlHandler) {
    return (
        <a href="javascript:;"
           onClick={() => urlHandler(href)}
           target="_blank"
           {...props}>
          {children}
        </a>
    );
  } else {
    return (
        <a href={href}
           target="_blank"
           {...props}>
          {children}
        </a>
    );
  }
}

export const BlockHashLink = ({hash}) => (
    <Link to={`/block/${hash}`}>{hash}</Link>
);

export const TransactionHashLink = ({hash, children}) => (
    <Link className="color-tron-100 list-item-word" to={`/transaction/${hash}`}>{children}</Link>
);

export const BlockNumberLink = ({number, children = null}) => {
  return (
      <Link to={`/block/${number}`}>
        {children || number}
      </Link>
  );
};

export const ContractLink = ({address, children = null}) => {
  async function pushto(){
    let {data} = await Client.getContractOverview(address);
    if(data instanceof Array){
      location.href = '/#/contract/'+address+'/code'
    }else{
     // location.href = '/#/address/'+address+'/token-balances'
        location.href = '/#/address/'+ address
    }
  }
  return (
    <div className="text-truncate">
      <a href="javascript:;" onClick={pushto}>{children || address}</a>
    </div>
  );
};