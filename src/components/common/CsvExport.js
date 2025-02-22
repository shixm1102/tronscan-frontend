import React, {Fragment} from "react";
import { Modal, Button } from 'antd';
import ContractCodeRequest from "../tools/ContractCodeRequest";
import {tu} from "../../utils/i18n";



export class CsvExport extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            visible: false,
            captcha_code:null,
        };
    }

    handleOk = e => {
        let {downloadURL} = this.props;
       window.location.href = downloadURL
    };
    handleCaptchaCode = (val) => {
        this.setState({captcha_code: val});
    };

    render() {
        return (
            <Fragment>
                <div style={{marginTop: 20, float: 'right'}}><i size="1" style={{fontStyle: 'normal'}}>[
                    Download <a href="javascript:;" onClick={() => this.setState({ visible: true})} style={{color: '#C23631'}}><b>CSV Export</b></a>&nbsp;<span
                        className="glyphicon glyphicon-download-alt"></span> ]</i>&nbsp;
                </div>
                <Modal
                    visible={this.state.visible}
                    okText="Download"
                    footer={null}
                    onCancel={() => this.setState({ visible: false})}
                    // centered
                >   
                    <div className="pt-3">
                        <ContractCodeRequest  handleCaptchaCode={this.handleCaptchaCode}/>
                    </div>
                    
                    <button 
                        className="btn btn-danger d-block mx-auto mt-3" 
                        disabled={!this.state.captcha_code}
                        onClick={this.handleOk}>{tu('Download')}</button>
                </Modal>
            </Fragment>

        )
    }
}
